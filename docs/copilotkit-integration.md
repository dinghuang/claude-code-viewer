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
│  │  <CopilotKit runtimeUrl="http://localhost:4000/copilotkit" │ │
│  │              agent="claude_code">                           │ │
│  │    <CopilotChat />                                         │ │
│  │  </CopilotKit>                                             │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ Single-Route JSON-RPC
                             │ POST /copilotkit
                             │ {"method":"agent/run","params":{...},"body":{...}}
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                CopilotKit Runtime (Node.js, Port 4000)           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CopilotRuntime + ExperimentalEmptyAdapter                 │ │
│  │  agents: { claude_code: LangGraphHttpAgent(url: ":8000") } │ │
│  │  copilotRuntimeNodeHttpEndpoint(endpoint: "/copilotkit")   │ │
│  └───────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ AG-UI Protocol
                             │ POST / (SSE Response)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Backend (Python FastAPI, Port 8000)              │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  LangGraphAgent(name="claude_code", graph=compiled_graph)  │ │
│  │  add_langgraph_fastapi_endpoint(app, agent, path="/")      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 前端集成

### 1. 安装依赖

```bash
npm install @copilotkit/react-core @copilotkit/react-ui @copilotkit/runtime
npm install reflect-metadata tsx   # Runtime 运行需要
```

### 2. CopilotKit Provider

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

const RUNTIME_URL = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000";

export default function App() {
  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}
      agent="claude_code"
    >
      <CopilotChat
        instructions="你是一个 AI智能投顾"
        labels={{ title: "AI智能投顾", initial: "您好，我是您的AI智能投顾，有什么我可以帮你的？" }}
      />
    </CopilotKit>
  );
}
```

**关键点：**
- `runtimeUrl` 必须指向 **Runtime** (port 4000)，不是 Python 后端
- `agent` 值必须匹配后端 `LangGraphAgent` 的 `name`
- CopilotKit v1.54.1 内部自动使用 `useSingleEndpoint: true`

### 3. CopilotKit Runtime Server

```typescript
// frontend/server/copilotkit-runtime.ts
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

### 1. 安装依赖

```bash
pip install "copilotkit>=0.1.83" "ag-ui-langgraph>=0.0.27" "langgraph>=1.0.0"
```

### 2. 创建 LangGraph Agent

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langchain_core.messages import AIMessage
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

def chat_node(state: MessagesState):
    user_message = state.get("messages", [])[-1].content
    return {"messages": [AIMessage(content=f"收到: {user_message}")]}

graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.add_edge(START, "chat")
graph.add_edge("chat", END)

agent = LangGraphAgent(
    name="claude_code",
    graph=graph.compile(checkpointer=MemorySaver()),
)
```

### 3. 注册 AG-UI 端点

```python
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

app = FastAPI()
add_langgraph_fastapi_endpoint(app, agent, path="/")
```

## 版本兼容性

| 前端包 | 版本 | Python 包 | 版本 | 兼容性 |
|--------|------|-----------|------|--------|
| @copilotkit/react-core | 1.54.1 | copilotkit | 0.1.83 | 通过 Runtime 桥接 |
| @copilotkit/runtime | 1.54.1 | ag-ui-langgraph | 0.0.28 | AG-UI 协议 |

**注意：**
- Python copilotkit SDK 要求 Python 3.10-3.12
- 前端与后端不直接通信，通过 Runtime 中间层桥接
- Runtime 同时包含在前端的 npm 依赖中

## 调试

### 检查 Runtime 信息

```bash
curl -s -X POST http://localhost:4000/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"method":"info"}'
```

### 检查后端 AG-UI 端点

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
