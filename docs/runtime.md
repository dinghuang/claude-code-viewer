# CopilotKit Runtime 中间层

## 概述

CopilotKit Runtime 是一个 Node.js 中间层服务，负责在前端 (Single-Route 协议) 和 Python 后端 (AG-UI 协议) 之间进行协议转换。

## 为什么需要 Runtime？

CopilotKit v1.54.1 架构中，前端和后端使用不同的通信协议：

| 层 | 协议 | 说明 |
|----|------|------|
| 前端 → Runtime | **Single-Route JSON-RPC** | 所有请求发到单一端点，body 中 `method` 字段区分操作 |
| Runtime → 后端 | **AG-UI SSE** | Agent-User Interaction 开源协议，基于事件流 |

Runtime 作为「翻译层」桥接两者。

## 架构位置

```
Frontend (3000)                 Runtime (4000)                Backend (8000)
┌──────────────┐    JSON-RPC    ┌──────────────────┐   AG-UI   ┌───────────┐
│ CopilotKit   │───────────────>│ CopilotRuntime   │──────────>│ FastAPI   │
│ React Core   │  POST /copilotkit │ + LangGraphHttp- │ POST / SSE │ + LangGraph│
│              │<───────────────│   Agent           │<──────────│ Agent     │
└──────────────┘   SSE Events   └──────────────────┘  Events   └───────────┘
```

## 实现

### 文件位置

`frontend/server/copilotkit-runtime.ts`

### 核心代码

```typescript
import "reflect-metadata";
import { createServer } from "node:http";
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";
const PORT = Number(process.env.RUNTIME_PORT || 4000);

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: {
    claude_code: new LangGraphHttpAgent({
      url: AGENT_URL,
    }),
  },
});

const handler = copilotRuntimeNodeHttpEndpoint({
  runtime,
  serviceAdapter,
  endpoint: "/copilotkit",
});
```

### 关键组件

| 组件 | 说明 |
|------|------|
| `CopilotRuntime` | CopilotKit 核心运行时，管理 Agent 注册和请求路由 |
| `ExperimentalEmptyAdapter` | 空适配器，不使用内置 LLM，仅使用外部 Agent |
| `LangGraphHttpAgent` | HTTP Agent 代理，将请求转发到 Python 后端的 AG-UI 端点 |
| `copilotRuntimeNodeHttpEndpoint` | 将 Runtime 暴露为 Node.js HTTP 端点 |

## 支持的协议方法

| 方法 | 说明 |
|------|------|
| `info` | 获取 Runtime 信息和已注册 Agent 列表 |
| `agent/run` | 执行 Agent (主要方法) |
| `agent/connect` | 连接到 Agent 会话 |
| `agent/stop` | 停止 Agent 执行 |

## 配置

### 环境变量

```bash
AGENT_URL=http://localhost:8000     # Python 后端 AG-UI 端点
RUNTIME_PORT=4000                   # Runtime 监听端口
```

### 依赖

```json
{
  "@copilotkit/runtime": "^1.54.1",
  "reflect-metadata": "^0.2.2",
  "tsx": "^4.21.0"
}
```

## 启动方式

```bash
cd frontend

# 独立启动
npx tsx server/copilotkit-runtime.ts

# npm script
npm run dev:runtime

# 与前端同时启动
npm run dev:all
```

## 调试

### 查看 Runtime 信息

```bash
curl -s -X POST http://localhost:4000/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"method":"info"}'
```

### 常见问题

| 问题 | 解决 |
|------|------|
| `EADDRINUSE: port 4000` | `lsof -ti:4000 \| xargs kill -9` |
| `Missing method field` | 确保前端使用 Single-Route 协议 |
| Runtime 无法连接后端 | 检查 `AGENT_URL` 和后端是否启动 |
