# CopilotKit 集成

## 概述

本项目使用 CopilotKit v1.54.1 提供前端 AI 聊天界面。CopilotKit 集成涉及三个层面：

| 层 | 包 | 版本 | 协议 |
|----|------|------|------|
| 前端 React | `@copilotkit/react-core` + `@copilotkit/react-ui` | 1.54.1 | Single-Route JSON-RPC |
| Runtime 中间层 | `@copilotkit/runtime` | 1.54.1 | Single-Route ↔ AG-UI |
| Python 后端 | `copilotkit` + `ag-ui-langgraph` | 0.1.83 / 0.0.28 | AG-UI SSE Events |

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React, Port 3000)                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  <CopilotKit runtimeUrl="localhost:4000/copilotkit"        │ │
│  │              agent="claude_code"                            │ │
│  │              threadId={SESSION_THREAD_ID}>                  │ │
│  │    <CopilotChat />                                         │ │
│  │  </CopilotKit>                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ Single-Route JSON-RPC
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                CopilotKit Runtime (Node.js, Port 4000)           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CopilotRuntime + ExperimentalEmptyAdapter                 │ │
│  │  agents: { claude_code: LangGraphHttpAgent(url: ":8000") } │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ AG-UI Protocol (SSE)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Python FastAPI, Port 8000)              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  LangGraphAgent(name="claude_code", graph=compiled_graph)  │ │
│  │  add_langgraph_fastapi_endpoint(app, agent, path="/")      │ │
│  │  Graph: prepare → execute → permission_check → collect     │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 前端集成

### 1. CopilotKit Provider + threadId

```tsx
import { CopilotKit, useCoAgentStateRender } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useLangGraphInterrupt } from "@copilotkit/react-core";

// 稳定 threadId — 页面生命周期内不变，保证 session 复用
const SESSION_THREAD_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function App() {
  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}
      agent="claude_code"
      threadId={SESSION_THREAD_ID}
    >
      <CopilotChat
        instructions="你是一个 AI智能投顾，帮助用户解决投资问题。"
        labels={{
          title: "AI智能投顾",
          initial: "您好，我是您的AI智能投顾，有什么我可以帮你的？",
          placeholder: "输入你的问题...",
        }}
      />
    </CopilotKit>
  );
}
```

**关键点：**
- `runtimeUrl` 必须指向 **Runtime** (port 4000)，不是 Python 后端
- `agent` 值必须匹配后端 `LangGraphAgent` 的 `name`
- `threadId` 保证同一页面会话内复用同一 LangGraph thread，实现上下文连续
- 刷新页面生成新 `threadId`，创建全新 session

### 2. LangGraph Interrupt (权限卡片)

```tsx
useLangGraphInterrupt({
  enabled: ({ eventValue }) => eventValue?.type === "permission_request",
  render: ({ event, resolve }) => (
    <PermissionCard
      denials={event.value.denials}
      message={event.value.message}
      onRespond={(approved) => resolve(JSON.stringify({ approved }))}
    />
  ),
});
```

当后端 `permission_check_node` 调用 `interrupt()` 时，前端渲染权限审批卡片。

### 3. CopilotKit Runtime Server

```typescript
import "reflect-metadata";
import { CopilotRuntime, ExperimentalEmptyAdapter, copilotRuntimeNodeHttpEndpoint } from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const runtime = new CopilotRuntime({
  agents: {
    claude_code: new LangGraphHttpAgent({ url: "http://localhost:8000" }),
  },
});

const handler = copilotRuntimeNodeHttpEndpoint({
  runtime,
  serviceAdapter: new ExperimentalEmptyAdapter(),
  endpoint: "/copilotkit",
});
```

## 后端集成

### 1. LangGraph Agent (4 nodes)

```python
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt
from langchain_core.messages import AIMessage

graph = StateGraph(ClaudeCodeState)
graph.add_node("prepare", prepare_node)
graph.add_node("execute", execute_node)          # claude_agent_sdk.query()
graph.add_node("permission_check", permission_check_node)  # interrupt()
graph.add_node("collect", collect_node)           # AIMessage

graph.add_edge(START, "prepare")
graph.add_edge("prepare", "execute")
graph.add_edge("execute", "permission_check")
graph.add_conditional_edges("permission_check", _route_after_permission)
graph.add_edge("collect", END)

compiled_graph = graph.compile(checkpointer=MemorySaver())
```

### 2. AG-UI 端点注册

```python
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

agent = LangGraphAgent(
    name="claude_code",
    description="Claude Code 助手 - AI智能投顾",
    graph=compiled_graph,
)
add_langgraph_fastapi_endpoint(app, agent, path="/")
```

## Session 复用机制

### 前端层

CopilotKit 的 `threadId` prop 控制 LangGraph thread：
- 固定 `threadId` → 同一 thread → LangGraph State 持久化
- State 中的 `claude_session_id` 在 thread 内持续存在

### 后端层

`execute_node` 中的 session 复用逻辑：
- 首次调用：无 `claude_session_id` → 创建新 session → 捕获 session_id
- 后续调用：有 `claude_session_id` → `ClaudeAgentOptions(resume=session_id)`

```
页面加载 → threadId=session-abc → LangGraph thread abc
  消息1 → execute(新session) → 捕获 sid=xxx → state.claude_session_id=xxx
  消息2 → execute(resume=xxx) → 复用 session xxx
  消息3 → execute(resume=xxx) → 继续复用

刷新页面 → threadId=session-def → LangGraph thread def (全新)
  消息1 → execute(新session) → 捕获 sid=yyy → state.claude_session_id=yyy
```

## 版本兼容性

| 前端包 | 版本 | Python 包 | 版本 |
|--------|------|-----------|------|
| @copilotkit/react-core | 1.54.1 | copilotkit | 0.1.83 |
| @copilotkit/react-ui | 1.54.1 | ag-ui-langgraph | 0.0.28 |
| @copilotkit/runtime | 1.54.1 | langgraph | 1.0+ |

**注意：**
- Python copilotkit SDK 要求 Python 3.10-3.12
- 前端与后端不直接通信，通过 Runtime 中间层桥接
- CopilotKit v1.54.1 内部自动使用 `useSingleEndpoint: true`

## 调试

### 检查 Runtime 信息

```bash
curl -s -X POST http://localhost:4000/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"method":"info"}'
```

### 检查后端健康

```bash
curl -s http://localhost:8000/health
```

### 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `Missing method field` | 前端发送了 GraphQL 而非 Single-Route | 检查 CopilotKit 版本和 runtimeUrl |
| `HTTP 422` | AG-UI 请求缺少必填字段 | 确保 Runtime 正确转发请求 |
| `Connection refused :4000` | Runtime 未启动 | `npm run dev:runtime` |
| Python 版本不兼容 | copilotkit 不支持 Python 3.13+ | 使用 Python 3.12 |
| 每次消息新建 session | `threadId` 不稳定或未传 | 确认 `threadId` 是模块级常量 |
