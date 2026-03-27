# backend/app/agents/claude_code_agent.py
"""CopilotKit Agent that bridges to Claude SDK."""

import uuid
import time
import asyncio
from typing import Optional, Dict, Any, List

from copilotkit import Agent
from copilotkit.types import Message
from copilotkit.action import ActionDict
from app.sdk.client import create_claude_client
from app.models import ProcessMessage, ProcessMessageType
from app.config import get_settings
from app.api.process_stream import broadcast_to_subscribers


class ClaudeCodeAgent(Agent):
    """CopilotKit Agent 桥接 Claude SDK"""

    def __init__(
        self,
        name: str = "claude_code",
        description: str = "Claude Code 助手 - 执行代码任务",
        working_dir: Optional[str] = None,
    ):
        super().__init__(name=name, description=description)
        self.working_dir = working_dir or get_settings().working_directory
        self._system_prompt_loaded = False
        self._permission_futures: Dict[str, asyncio.Future] = {}

    def execute(
        self,
        *,
        state: dict,
        config: Optional[dict] = None,
        messages: List[Message],
        thread_id: str,
        actions: Optional[List[ActionDict]] = None,
        node_name: Optional[str] = None,
        meta_events: Optional[List] = None,
        **kwargs,
    ):
        """执行 Agent - 由 CopilotKit 调用

        This method yields events in the format expected by CopilotKit.
        """
        user_message = messages[-1].get("content", "") if messages else ""
        settings = get_settings()

        # 首次对话时，加载系统提示词
        if not self._system_prompt_loaded:
            system_prompt = settings.get_system_prompt()
            if system_prompt:
                # 发送系统提示词作为思维过程
                asyncio.create_task(self._broadcast_system_prompt(system_prompt))
            self._system_prompt_loaded = True

        # 发送用户消息到思维过程
        asyncio.create_task(self._broadcast_user_message(user_message))

        # 执行 Claude Code 并 yield 事件
        return self._execute_async(user_message, thread_id)

    async def _execute_async(self, user_message: str, thread_id: str):
        """异步执行并 yield 事件"""
        # 创建客户端
        client = create_claude_client(
            working_dir=self.working_dir,
            can_use_tool=self._handle_permission,
        )

        try:
            async for msg in client.query(user_message):
                # 广播思维过程
                process_msg = self._convert_to_process_message(msg)
                if process_msg:
                    await broadcast_to_subscribers(process_msg)

                # 如果是最终结果，返回给 CopilotKit
                if hasattr(msg, 'result') and msg.result:
                    yield self._make_event(
                        type="result",
                        content=msg.result,
                        metadata={
                            "cost": getattr(msg, 'total_cost_usd', None),
                            "duration_ms": getattr(msg, 'duration_ms', None),
                        }
                    )

        except Exception as e:
            await broadcast_to_subscribers(ProcessMessage(
                id=str(uuid.uuid4()),
                type=ProcessMessageType.ERROR,
                content=f"错误: {str(e)}",
                timestamp=int(time.time() * 1000),
            ))
            yield self._make_event(
                type="error",
                content=f"执行出错: {str(e)}"
            )

    def _make_event(self, type: str, content: str, **kwargs) -> str:
        """创建 CopilotKit 事件格式"""
        import json
        event = {"type": type, "content": content, **kwargs}
        return json.dumps(event) + "\n"

    async def _broadcast_system_prompt(self, prompt: str):
        """广播系统提示词"""
        await broadcast_to_subscribers(ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.TEXT,
            content=f"[系统提示词已加载]\n{prompt[:200]}...",
            timestamp=int(time.time() * 1000),
        ))

    async def _broadcast_user_message(self, message: str):
        """广播用户消息"""
        await broadcast_to_subscribers(ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.TEXT,
            content=f"用户: {message}",
            timestamp=int(time.time() * 1000),
        ))

    async def _handle_permission(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        context: Any
    ):
        """处理权限请求"""
        request_id = str(uuid.uuid4())
        risk_level = self._get_risk_level(tool_name)

        # 广播权限请求到前端
        permission_msg = ProcessMessage(
            id=request_id,
            type=ProcessMessageType.PERMISSION,
            content=f"请求执行工具: {tool_name}",
            timestamp=int(time.time() * 1000),
            tool_name=tool_name,
            tool_input=tool_input,
            risk_level=risk_level,
        )
        await broadcast_to_subscribers(permission_msg)

        # 低风险操作自动批准
        if risk_level == "low":
            return {"allowed": True, "reason": "低风险操作自动批准"}

        # 中高风险需要用户确认
        future = asyncio.Future()
        self._permission_futures[request_id] = future

        try:
            result = await asyncio.wait_for(future, timeout=60.0)
            return result
        except asyncio.TimeoutError:
            return {"allowed": False, "reason": "等待用户确认超时"}
        finally:
            self._permission_futures.pop(request_id, None)

    def resolve_permission(self, request_id: str, approved: bool):
        """解决权限请求 (由 CopilotKit Action 调用)"""
        future = self._permission_futures.get(request_id)
        if future and not future.done():
            future.set_result({
                "allowed": approved,
                "reason": "用户确认" if approved else "用户拒绝"
            })

    async def get_state(self, *, thread_id: str):
        """获取 Agent 状态"""
        return {
            "threadId": thread_id,
            "threadExists": False,
            "state": {},
            "messages": []
        }

    def _get_risk_level(self, tool_name: str) -> str:
        """根据工具名判断风险等级"""
        HIGH_RISK = {"Bash", "Write", "Edit", "delete_file", "rm", "sudo"}
        MEDIUM_RISK = {"git", "npm", "pip", "mkdir", "mv"}

        tool_lower = tool_name.lower()
        if tool_name in HIGH_RISK or any(h.lower() in tool_lower for h in HIGH_RISK):
            return "high"
        elif tool_name in MEDIUM_RISK or any(m.lower() in tool_lower for m in MEDIUM_RISK):
            return "medium"
        return "low"

    def _convert_to_process_message(self, msg) -> Optional[ProcessMessage]:
        """将 Claude SDK 消息转换为 ProcessMessage"""
        msg_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)

        msg_type = type(msg).__name__

        if msg_type == "AssistantMessage":
            content = ""
            if hasattr(msg, 'content'):
                if isinstance(msg.content, str):
                    content = msg.content
                elif isinstance(msg.content, list):
                    for block in msg.content:
                        if hasattr(block, 'text'):
                            content += block.text
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TEXT,
                content=content[:500] if content else "",
                timestamp=timestamp,
            )

        elif msg_type == "ToolUseBlock":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TOOL_USE,
                content=f"调用工具: {getattr(msg, 'name', 'unknown')}",
                timestamp=timestamp,
                tool_name=getattr(msg, 'name', None),
                tool_input=getattr(msg, 'input', None),
            )

        elif msg_type == "ToolResultBlock":
            content = getattr(msg, 'content', '')
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TOOL_RESULT,
                content=str(content)[:500] if content else "",
                timestamp=timestamp,
                tool_result=content,
            )

        elif msg_type == "ResultMessage":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.RESULT,
                content=getattr(msg, 'result', '任务完成') or "任务完成",
                timestamp=timestamp,
                cost=getattr(msg, 'total_cost_usd', None),
            )

        elif msg_type == "ThinkingBlock":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.THINKING,
                content=getattr(msg, 'thinking', '') or "",
                timestamp=timestamp,
            )

        return None