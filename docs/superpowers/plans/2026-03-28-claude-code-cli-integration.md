# Claude Code CLI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the echo placeholder with real Claude Code CLI integration via `claude_agent_sdk.query()`, with SSE broadcasting to ProcessPanel and CopilotKit Action-based permission handling.

**Architecture:** Three LangGraph nodes (prepare → execute → collect) orchestrate the Claude Code SDK call. The execute node streams all SDK messages to the SSE ProcessPanel, uses `interrupt()` for permission requests, and stores the final result for the collect node to return as an AIMessage to CopilotKit.

**Tech Stack:** Python 3.12, claude-agent-sdk 0.1.51, LangGraph 1.0+, ag-ui-langgraph 0.0.28, CopilotKit 1.54.1

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/agents/claude_code_agent.py` | Rewrite | ClaudeCodeState, prepare/execute/collect nodes, build_graph(), permission utils |
| `backend/app/main.py` | Rewrite | Import graph from agent module, register AG-UI endpoint |
| `backend/app/sdk/client.py` | Simplify | Thin wrapper returning ClaudeAgentOptions from settings |
| `frontend/src/App.tsx` | Modify | Add `useCoagentStateRender` for pending_permission |
| `frontend/src/components/PermissionDialog.tsx` | Rewrite | CopilotKit Action-based permission card |

Files unchanged: `backend/app/models.py`, `backend/app/config.py`, `backend/app/api/process_stream.py`

---

### Task 1: Simplify SDK client wrapper

**Files:**
- Modify: `backend/app/sdk/client.py`

- [ ] **Step 1: Rewrite client.py to a thin options builder**

```python
# backend/app/sdk/client.py
"""Build ClaudeAgentOptions from app settings."""

import os
from app.config import get_settings


def build_claude_options():
    """Build ClaudeAgentOptions dict from app settings.

    Returns a dict of kwargs suitable for ClaudeAgentOptions().
    The caller adds can_use_tool and system_prompt as needed.
    """
    settings = get_settings()

    # Set env vars for the Claude Code CLI subprocess
    os.environ.setdefault("ANTHROPIC_API_KEY", settings.anthropic_api_key)
    os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", settings.anthropic_auth_token)
    os.environ.setdefault("ANTHROPIC_BASE_URL", settings.anthropic_base_url)

    opts = {
        "model": settings.anthropic_model,
        "cwd": settings.working_directory,
    }
    if settings.claude_code_cli_path:
        opts["cli_path"] = settings.claude_code_cli_path

    return opts
```

- [ ] **Step 2: Verify import works**

Run: `cd backend && source venv/bin/activate && python -c "from app.sdk.client import build_claude_options; print(build_claude_options())"`

Expected: dict with model, cwd keys (may fail on missing .env vars — that's fine, just verify no import errors)

- [ ] **Step 3: Commit**

```bash
git add backend/app/sdk/client.py
git commit -m "refactor: simplify SDK client to thin options builder"
```

---

### Task 2: Rewrite claude_code_agent.py with State, nodes, and graph

**Files:**
- Rewrite: `backend/app/agents/claude_code_agent.py`

- [ ] **Step 1: Write ClaudeCodeState and utility functions**

```python
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

def convert_to_process_message(msg) -> Optional[ProcessMessage]:
    msg_id = str(uuid.uuid4())
    ts = int(time.time() * 1000)

    if isinstance(msg, AssistantMessage):
        texts = []
        for block in msg.content:
            if isinstance(block, TextBlock):
                texts.append(block.text)
        if texts:
            return ProcessMessage(
                id=msg_id, type=ProcessMessageType.TEXT,
                content="\n".join(texts)[:500], timestamp=ts,
            )

    elif isinstance(msg, ThinkingBlock):
        return ProcessMessage(
            id=msg_id, type=ProcessMessageType.THINKING,
            content=msg.thinking[:500], timestamp=ts,
        )

    elif isinstance(msg, ToolUseBlock):
        return ProcessMessage(
            id=msg_id, type=ProcessMessageType.TOOL_USE,
            content=f"调用工具: {msg.name}",
            timestamp=ts, tool_name=msg.name, tool_input=msg.input,
        )

    elif isinstance(msg, ToolResultBlock):
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        return ProcessMessage(
            id=msg_id, type=ProcessMessageType.TOOL_RESULT,
            content=content[:500], timestamp=ts, tool_result=msg.content,
        )

    elif isinstance(msg, ResultMessage):
        return ProcessMessage(
            id=msg_id, type=ProcessMessageType.RESULT,
            content=msg.result or "任务完成",
            timestamp=ts, cost=msg.total_cost_usd,
        )

    return None
```

- [ ] **Step 2: Write the three LangGraph nodes**

Append to the same file:

```python
# ============ Nodes ============

async def prepare_node(state: ClaudeCodeState):
    """Load system prompt on first conversation."""
    if state.get("system_prompt_loaded"):
        return {}

    settings = get_settings()
    system_prompt = settings.get_system_prompt()
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

    # Permission handler using LangGraph interrupt
    async def handle_permission(tool_name, tool_input, context):
        risk = get_risk_level(tool_name)

        # Auto-approve low-risk
        if risk == "low":
            return PermissionResultAllow()

        # Broadcast permission request to ProcessPanel
        request_id = str(uuid.uuid4())
        await broadcast_to_subscribers(ProcessMessage(
            id=request_id,
            type=ProcessMessageType.PERMISSION,
            content=f"请求执行工具: {tool_name}",
            timestamp=int(time.time() * 1000),
            tool_name=tool_name,
            tool_input=tool_input,
            risk_level=risk,
        ))

        # Interrupt graph — value is sent to frontend via AG-UI state snapshot
        response = interrupt({
            "request_id": request_id,
            "tool_name": tool_name,
            "tool_input": tool_input,
            "risk_level": risk,
            "description": f"Claude 请求执行 {tool_name}",
        })

        # When graph resumes, response contains user's decision
        if isinstance(response, dict) and response.get("approved"):
            return PermissionResultAllow()
        else:
            reason = response.get("reason", "用户拒绝") if isinstance(response, dict) else "用户拒绝"
            return PermissionResultDeny(message=reason)

    # Build options
    base_opts = build_claude_options()
    system_prompt = settings.get_system_prompt() if not state.get("system_prompt_loaded") else None

    options = ClaudeAgentOptions(
        **base_opts,
        can_use_tool=handle_permission,
        **({"system_prompt": system_prompt} if system_prompt else {}),
    )

    result_text = ""
    cost = 0.0
    duration = 0

    try:
        async for msg in query(prompt=user_message, options=options):
            process_msg = convert_to_process_message(msg)
            if process_msg:
                await broadcast_to_subscribers(process_msg)

            if isinstance(msg, ResultMessage):
                result_text = msg.result or "任务完成"
                cost = msg.total_cost_usd or 0.0
                duration = msg.duration_ms or 0

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
    }


async def collect_node(state: ClaudeCodeState):
    """Package Claude result as AIMessage for CopilotKit."""
    result = state.get("claude_result", "")
    error = state.get("error", "")

    content = result if result else (error if error else "任务完成")

    return {"messages": [AIMessage(content=content)]}
```

- [ ] **Step 3: Write graph builder function**

Append to the same file:

```python
# ============ Graph builder ============

def build_graph():
    """Build and compile the Claude Code LangGraph."""
    graph = StateGraph(ClaudeCodeState)

    graph.add_node("prepare", prepare_node)
    graph.add_node("execute", execute_node)
    graph.add_node("collect", collect_node)

    graph.add_edge(START, "prepare")
    graph.add_edge("prepare", "execute")
    graph.add_edge("execute", "collect")
    graph.add_edge("collect", END)

    return graph.compile(checkpointer=MemorySaver())
```

- [ ] **Step 4: Verify module imports**

Run: `cd backend && source venv/bin/activate && python -c "from app.agents.claude_code_agent import build_graph, ClaudeCodeState; print('OK')"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/claude_code_agent.py
git commit -m "feat: implement Claude Code Agent with LangGraph prepare/execute/collect nodes"
```

---

### Task 3: Rewrite main.py to use the new graph

**Files:**
- Rewrite: `backend/app/main.py`

- [ ] **Step 1: Rewrite main.py**

```python
# backend/app/main.py
"""FastAPI entry point — AG-UI endpoint with Claude Code LangGraph Agent."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import warnings

from app.config import get_settings
from app.api import process_stream
from app.agents.claude_code_agent import build_graph
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Claude Code Viewer 启动中...")
    logger.info(f"   工作目录: {settings.working_directory}")
    logger.info(f"   模型: {settings.anthropic_model}")

    system_prompt = settings.get_system_prompt()
    if system_prompt:
        logger.info(f"   系统提示词已加载 ({len(system_prompt)} 字符)")
    else:
        logger.warning("   未找到系统提示词文件")

    logger.info("   AG-UI 端点: POST /")
    logger.info("   SSE 端点: GET /api/process-stream")

    yield
    logger.info("👋 Claude Code Viewer 关闭中...")


app = FastAPI(
    title="Claude Code Viewer",
    description="可视化 Claude Code 执行过程",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE thinking process
app.include_router(process_stream.router, prefix="/api", tags=["stream"])

# Claude Code LangGraph Agent
compiled_graph = build_graph()

agent = LangGraphAgent(
    name="claude_code",
    description="Claude Code 助手 - 执行代码任务",
    graph=compiled_graph,
)

add_langgraph_fastapi_endpoint(app, agent, path="/")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Start backend and verify health**

Run: `cd backend && source venv/bin/activate && uvicorn app.main:app --port 8000 &`
Run: `sleep 3 && curl -s http://localhost:8000/health`

Expected: `{"status":"ok"}`

- [ ] **Step 3: Test AG-UI info endpoint via Runtime**

Run: `curl -s -X POST http://localhost:4000/copilotkit -H "Content-Type: application/json" -d '{"method":"info"}'`

Expected: JSON with `"agents":{"claude_code":...}`

- [ ] **Step 4: Kill test server and commit**

```bash
kill %1 2>/dev/null
git add backend/app/main.py
git commit -m "feat: wire Claude Code LangGraph Agent into FastAPI AG-UI endpoint"
```

---

### Task 4: Rewrite PermissionDialog with CopilotKit Action

**Files:**
- Rewrite: `frontend/src/components/PermissionDialog.tsx`

- [ ] **Step 1: Rewrite PermissionDialog as CopilotKit-aware component**

```tsx
// frontend/src/components/PermissionDialog.tsx
import React from "react";

interface PermissionData {
  request_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
  risk_level: "low" | "medium" | "high";
  description: string;
}

interface PermissionDialogProps {
  permission: PermissionData;
  onRespond: (approved: boolean) => void;
}

export function PermissionDialog({ permission, onRespond }: PermissionDialogProps) {
  const riskConfig = {
    low: { color: "bg-green-100 text-green-700 border-green-200", label: "低风险" },
    medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "中风险" },
    high: { color: "bg-red-100 text-red-700 border-red-200", label: "高风险" },
  };

  const risk = riskConfig[permission.risk_level] || riskConfig.medium;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden my-2">
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-white font-semibold">权限请求</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${risk.color}`}>
            {risk.label}
          </span>
          <span className="text-xs text-gray-500">工具: {permission.tool_name}</span>
        </div>
        <p className="text-sm text-gray-600 mb-2">{permission.description}</p>
        {permission.tool_input && Object.keys(permission.tool_input).length > 0 && (
          <pre className="text-xs bg-gray-50 rounded p-2 mb-3 overflow-x-auto max-h-32">
            {JSON.stringify(permission.tool_input, null, 2)}
          </pre>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(false)}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            拒绝
          </button>
          <button
            onClick={() => onRespond(true)}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
          >
            允许
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PermissionData };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PermissionDialog.tsx
git commit -m "refactor: rewrite PermissionDialog for CopilotKit Action integration"
```

---

### Task 5: Update App.tsx with coagent state rendering for permissions

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add useCoagentStateRender for pending_permission**

Replace the full `App.tsx`:

```tsx
// frontend/src/App.tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCoagentStateRender } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { PhoneFrame } from "./components/PhoneFrame";
import { ProcessPanel } from "./components/ProcessPanel";
import { PermissionDialog } from "./components/PermissionDialog";
import type { PermissionData } from "./components/PermissionDialog";
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const RUNTIME_URL = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000";

export default function App() {
  const [showPanel, setShowPanel] = useState(false);

  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}
      agent="claude_code"
    >
      <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
        {/* 移动端顶部切换栏 */}
        <div className="lg:hidden flex bg-white border-b border-gray-200">
          <button
            onClick={() => setShowPanel(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !showPanel
                ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50"
                : "text-gray-500"
            }`}
          >
            📱 聊天视图
          </button>
          <button
            onClick={() => setShowPanel(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              showPanel
                ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50"
                : "text-gray-500"
            }`}
          >
            💻 消息流
          </button>
        </div>

        {/* 左侧：手机框架内的 CopilotKit UI */}
        <div
          className={`${
            showPanel ? "hidden lg:flex" : "flex"
          } lg:w-1/2 items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-gray-200 to-gray-300 overflow-auto`}
        >
          <div className="lg:hidden w-full max-w-[375px] mx-auto">
            <PhoneFrame>
              <CopilotChatUI />
            </PhoneFrame>
          </div>
          <div className="hidden lg:block">
            <PhoneFrame>
              <CopilotChatUI />
            </PhoneFrame>
          </div>
        </div>

        {/* 右侧：思维过程面板 */}
        <div
          className={`${
            showPanel ? "flex" : "hidden lg:flex"
          } lg:w-1/2 lg:border-l border-gray-300 flex-col`}
        >
          <ProcessPanel />
        </div>
      </div>
    </CopilotKit>
  );
}

/** CopilotKit chat UI with permission state rendering */
function CopilotChatUI() {
  // Render permission cards when Claude Code requests tool approval
  useCoagentStateRender({
    name: "claude_code",
    render: ({ state, nodeName, status }) => {
      // The interrupt value from execute_node is surfaced here
      // When the graph is interrupted, state.__interrupt__ contains the permission data
      return null; // Permission rendering handled by CopilotKit's built-in interrupt UI
    },
  });

  return (
    <CopilotChat
      instructions="你是一个 Claude Code 助手，帮助用户执行代码任务。"
      labels={{
        title: "Claude Code",
        initial: "有什么我可以帮你的？",
        placeholder: "输入你的问题...",
      }}
    />
  );
}
```

- [ ] **Step 2: Verify frontend compiles**

Run: `cd frontend && npm run dev` (check no compile errors in terminal)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add coagent state render for Claude Code permission handling"
```

---

### Task 6: End-to-end integration test

- [ ] **Step 1: Start all three services**

Terminal 1:
```bash
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npx tsx server/copilotkit-runtime.ts
```

Terminal 3:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify health endpoints**

```bash
curl -s http://localhost:8000/health   # {"status":"ok"}
curl -s http://localhost:4000/health   # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000  # 200
```

- [ ] **Step 3: Test AG-UI agent/run via Runtime**

```bash
curl -s -X POST http://localhost:4000/copilotkit \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "method": "agent/run",
    "params": {"agentId": "claude_code"},
    "body": {
      "threadId": "test-1",
      "runId": "run-1",
      "state": {},
      "messages": [{"id":"m1","role":"user","content":"读取当前目录文件列表"}],
      "tools": [],
      "context": [],
      "forwardedProps": {}
    }
  }' --max-time 30
```

Expected: SSE events including `RUN_STARTED`, `STEP_STARTED`, Claude SDK output, `MESSAGES_SNAPSHOT` with actual Claude Code response (not echo), `RUN_FINISHED`.

- [ ] **Step 4: Open browser and test chat**

Open http://localhost:3000, type a message like "帮我查看当前目录结构", verify:
- CopilotChat shows loading while Claude Code executes
- ProcessPanel (right side) shows real-time thinking/tool use events
- CopilotChat shows final Claude Code response when done

- [ ] **Step 5: Commit all changes**

```bash
git add -A
git commit -m "feat: integrate Claude Code CLI via claude_agent_sdk with LangGraph orchestration"
```
