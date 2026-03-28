# backend/app/agents/claude_code_agent.py
"""Claude Code Agent — LangGraph nodes + graph builder."""

import uuid
import time
import logging
from typing import Optional, Dict, Any, Annotated

from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt, Command
from langchain_core.messages import AIMessage, SystemMessage

from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    AssistantMessage,
    UserMessage,
    SystemMessage as ClaudeSystemMessage,
    ThinkingBlock,
    ToolUseBlock,
    ToolResultBlock,
    TextBlock,
)

from app.config import get_settings
from app.models import ProcessMessage, ProcessMessageType
from app.api.process_stream import broadcast_to_subscribers
from app.sdk.client import build_claude_options

logger = logging.getLogger(__name__)


# ============ State ============

class ClaudeCodeState(MessagesState):
    system_prompt_loaded: bool
    claude_result: str
    claude_cost: float
    claude_duration_ms: int
    permission_denials: list          # from ResultMessage.permission_denials
    retry_with_bypass: bool           # set when user approves denied permissions
    pending_permission: Optional[Dict[str, Any]]
    permission_response: Optional[Dict[str, Any]]
    error: str


# ============ Risk levels ============

HIGH_RISK = {"Bash", "Write", "Edit", "delete_file", "rm", "sudo"}
MEDIUM_RISK = {"git", "npm", "pip", "mkdir", "mv"}


def get_risk_level(tool_name: str) -> str:
    tool_lower = tool_name.lower()
    if tool_name in HIGH_RISK or any(h.lower() in tool_lower for h in HIGH_RISK):
        return "high"
    if tool_name in MEDIUM_RISK or any(m.lower() in tool_lower for m in MEDIUM_RISK):
        return "medium"
    return "low"


# ============ Message converter ============

def convert_to_process_messages(msg) -> list[ProcessMessage]:
    """Convert a Claude SDK message to one or more ProcessMessages.

    AssistantMessage can contain multiple blocks (ThinkingBlock, ToolUseBlock,
    TextBlock), each becoming a separate ProcessMessage. UserMessage contains
    ToolResultBlock from tool execution. SystemMessage shows init info.
    """
    ts = int(time.time() * 1000)
    results = []

    if isinstance(msg, AssistantMessage):
        for block in msg.content:
            msg_id = str(uuid.uuid4())
            if isinstance(block, ThinkingBlock):
                if block.thinking.strip():
                    results.append(ProcessMessage(
                        id=msg_id, type=ProcessMessageType.THINKING,
                        content=block.thinking[:1000], timestamp=ts,
                    ))
            elif isinstance(block, ToolUseBlock):
                results.append(ProcessMessage(
                    id=msg_id, type=ProcessMessageType.TOOL_USE,
                    content=f"调用工具: {block.name}",
                    timestamp=ts, tool_name=block.name, tool_input=block.input,
                ))
            elif isinstance(block, TextBlock):
                if block.text.strip():
                    results.append(ProcessMessage(
                        id=msg_id, type=ProcessMessageType.TEXT,
                        content=block.text[:1000], timestamp=ts,
                    ))
            elif isinstance(block, ToolResultBlock):
                content = block.content if isinstance(block.content, str) else str(block.content)
                results.append(ProcessMessage(
                    id=msg_id, type=ProcessMessageType.TOOL_RESULT,
                    content=content[:1000], timestamp=ts, tool_result=block.content,
                ))

    elif isinstance(msg, UserMessage):
        # UserMessage contains ToolResultBlock from tool execution
        content_list = msg.content if isinstance(msg.content, list) else []
        for block in content_list:
            if isinstance(block, ToolResultBlock):
                msg_id = str(uuid.uuid4())
                content = block.content if isinstance(block.content, str) else str(block.content)
                is_permission_denial = block.is_error and "permission" in content.lower()
                if is_permission_denial:
                    results.append(ProcessMessage(
                        id=msg_id, type=ProcessMessageType.PERMISSION,
                        content=content[:1000], timestamp=ts,
                        risk_level="high",
                    ))
                else:
                    results.append(ProcessMessage(
                        id=msg_id, type=ProcessMessageType.TOOL_RESULT,
                        content=content[:1000], timestamp=ts, tool_result=block.content,
                    ))

    elif isinstance(msg, ClaudeSystemMessage):
        msg_id = str(uuid.uuid4())
        subtype = getattr(msg, 'subtype', '')
        if subtype == 'init':
            data = getattr(msg, 'data', {})
            cwd = data.get('cwd', '') if isinstance(data, dict) else ''
            session_id = data.get('session_id', '')[:8] if isinstance(data, dict) else ''
            results.append(ProcessMessage(
                id=msg_id, type=ProcessMessageType.TEXT,
                content=f"[会话初始化] 工作目录: {cwd}" + (f" (session: {session_id}...)" if session_id else ""),
                timestamp=ts,
            ))

    elif isinstance(msg, ResultMessage):
        msg_id = str(uuid.uuid4())
        cost_str = f"${msg.total_cost_usd:.4f}" if msg.total_cost_usd else ""
        duration_str = f"{msg.duration_ms / 1000:.1f}s" if msg.duration_ms else ""
        turns_str = f"{msg.num_turns} turns" if hasattr(msg, 'num_turns') and msg.num_turns else ""
        meta_parts = [p for p in [cost_str, duration_str, turns_str] if p]
        content = f"任务完成 ({', '.join(meta_parts)})" if meta_parts else "任务完成"
        results.append(ProcessMessage(
            id=msg_id, type=ProcessMessageType.RESULT,
            content=content, timestamp=ts, cost=msg.total_cost_usd,
        ))

    # Standalone blocks (rare, but handle just in case)
    elif isinstance(msg, ThinkingBlock):
        if msg.thinking.strip():
            results.append(ProcessMessage(
                id=str(uuid.uuid4()), type=ProcessMessageType.THINKING,
                content=msg.thinking[:1000], timestamp=ts,
            ))

    elif isinstance(msg, ToolUseBlock):
        results.append(ProcessMessage(
            id=str(uuid.uuid4()), type=ProcessMessageType.TOOL_USE,
            content=f"调用工具: {msg.name}",
            timestamp=ts, tool_name=msg.name, tool_input=msg.input,
        ))

    elif isinstance(msg, ToolResultBlock):
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        results.append(ProcessMessage(
            id=str(uuid.uuid4()), type=ProcessMessageType.TOOL_RESULT,
            content=content[:1000], timestamp=ts, tool_result=msg.content,
        ))

    return results


# ============ In-memory system prompt store ============

_system_prompt_override: Optional[str] = None
_permission_mode: str = "bypassPermissions"


def set_system_prompt(prompt: str):
    """Set system prompt from frontend."""
    global _system_prompt_override
    _system_prompt_override = prompt


def get_effective_system_prompt() -> Optional[str]:
    """Get system prompt: frontend override > file-based fallback."""
    if _system_prompt_override is not None:
        return _system_prompt_override
    return get_settings().get_system_prompt()


def set_permission_mode(mode: str):
    """Set permission mode from frontend."""
    global _permission_mode
    _permission_mode = mode


def get_permission_mode() -> str:
    return _permission_mode


# ============ Nodes ============

async def prepare_node(state: ClaudeCodeState):
    """Load system prompt on first conversation."""
    if state.get("system_prompt_loaded"):
        return {}

    system_prompt = get_effective_system_prompt()
    if system_prompt:
        await broadcast_to_subscribers(ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.TEXT,
            content=f"[系统提示词已加载] ({len(system_prompt)} 字符)",
            timestamp=int(time.time() * 1000),
        ))

    return {"system_prompt_loaded": True}


async def execute_node(state: ClaudeCodeState):
    """Call claude_agent_sdk.query() and stream messages to SSE."""
    user_message = ""
    for msg in reversed(state.get("messages", [])):
        if hasattr(msg, "content") and (not hasattr(msg, "type") or msg.type == "human"):
            user_message = msg.content if isinstance(msg.content, str) else str(msg.content)
            break

    if not user_message:
        return {"error": "No user message found"}

    settings = get_settings()

    base_opts = build_claude_options()
    system_prompt = get_effective_system_prompt() if not state.get("system_prompt_loaded") else None

    # If retrying after user approved permissions, force bypassPermissions
    if state.get("retry_with_bypass"):
        perm_mode = "bypassPermissions"
        await broadcast_to_subscribers(ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.TEXT,
            content="[用户已授权] 以 bypassPermissions 模式重新执行...",
            timestamp=int(time.time() * 1000),
        ))
    else:
        perm_mode = get_permission_mode()

    options = ClaudeAgentOptions(
        **base_opts,
        permission_mode=perm_mode,
        **({"system_prompt": system_prompt} if system_prompt else {}),
    )

    result_text = ""
    cost = 0.0
    duration = 0
    denials = []

    try:
        async for msg in query(prompt=user_message, options=options):
            logger.info(f"SDK message: type={type(msg).__name__}")
            for process_msg in convert_to_process_messages(msg):
                await broadcast_to_subscribers(process_msg)

            if isinstance(msg, ResultMessage):
                result_text = msg.result or "任务完成"
                cost = msg.total_cost_usd or 0.0
                duration = msg.duration_ms or 0
                denials = msg.permission_denials or []

    except Exception as e:
        logger.error(f"Claude SDK error: {e}")
        await broadcast_to_subscribers(ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.ERROR,
            content=f"执行错误: {str(e)}",
            timestamp=int(time.time() * 1000),
        ))
        return {"error": str(e), "claude_result": f"执行出错: {str(e)}"}

    return {
        "claude_result": result_text,
        "claude_cost": cost,
        "claude_duration_ms": duration,
        "system_prompt_loaded": True,
        "permission_denials": denials,
        "retry_with_bypass": False,
    }


async def permission_check_node(state: ClaudeCodeState):
    """Check for permission denials and interrupt if any.

    If tools were denied, interrupt the graph with the denial list.
    Frontend renders a permission card. When user responds:
    - approved → set retry_with_bypass=True, route back to execute
    - denied → proceed to collect with the denied result
    """
    denials = state.get("permission_denials", [])
    if not denials:
        return {}

    # Build a human-readable summary for the interrupt card
    denied_tools = []
    for d in denials:
        tool_name = d.get("tool_name", "unknown")
        tool_input = d.get("tool_input", {})
        denied_tools.append({
            "tool_name": tool_name,
            "tool_input": tool_input,
            "risk_level": get_risk_level(tool_name),
        })

    # Interrupt — surfaces to frontend via AG-UI, rendered by useLangGraphInterrupt
    response = interrupt({
        "type": "permission_request",
        "denials": denied_tools,
        "message": f"Claude 请求执行 {len(denied_tools)} 个被拒绝的操作",
    })

    # Parse user's response
    approved = False
    if isinstance(response, str):
        try:
            import json
            response = json.loads(response)
        except (json.JSONDecodeError, TypeError):
            pass
    if isinstance(response, dict):
        approved = response.get("approved", False)

    if approved:
        return {
            "retry_with_bypass": True,
            "permission_denials": [],
            "claude_result": "",
        }
    else:
        return {"permission_denials": []}


def _route_after_permission(state: ClaudeCodeState) -> str:
    """Route back to execute if user approved, otherwise to collect."""
    if state.get("retry_with_bypass"):
        return "execute"
    return "collect"


async def collect_node(state: ClaudeCodeState):
    """Package Claude result as AIMessage for CopilotKit."""
    result = state.get("claude_result", "")
    error = state.get("error", "")

    content = result if result else (error if error else "任务完成")

    return {"messages": [AIMessage(content=content)]}


# ============ Graph builder ============

def build_graph():
    """Build and compile the Claude Code LangGraph."""
    graph = StateGraph(ClaudeCodeState)

    graph.add_node("prepare", prepare_node)
    graph.add_node("execute", execute_node)
    graph.add_node("permission_check", permission_check_node)
    graph.add_node("collect", collect_node)

    graph.add_edge(START, "prepare")
    graph.add_edge("prepare", "execute")
    graph.add_edge("execute", "permission_check")
    graph.add_conditional_edges("permission_check", _route_after_permission)
    graph.add_edge("collect", END)

    return graph.compile(checkpointer=MemorySaver())
