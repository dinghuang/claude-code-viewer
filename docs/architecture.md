# 架构设计

## 系统分层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户界面层 (Frontend)                        │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐ │
│  │   PhoneFrame        │   │   ProcessPanel                       │ │
│  │   ┌───────────────┐ │   │   (展示完整思维过程 - SSE 流)         │ │
│  │   │ CopilotKit    │ │   │   - ThinkingBlock                   │ │
│  │   │ - CopilotChat │ │   │   - ToolUseBlock                    │ │
│  │   │ - Permission  │ │   │   - ToolResultBlock                 │ │
│  │   │ - Selection   │ │   │   - ResultMessage                   │ │
│  │   └───────────────┘ │   │                                     │ │
│  └─────────────────────┘   └──────────────────────────────────────┘ │
│  React 18 + Vite + Tailwind CSS + CopilotKit v1.54.1               │
│  Port: 3000                                                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ Single-Route JSON-RPC Protocol
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    CopilotKit Runtime 中间层                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Node.js CopilotKit Runtime Server                             │ │
│  │  ├── CopilotRuntime + ExperimentalEmptyAdapter                │ │
│  │  ├── LangGraphHttpAgent → 转发到 Python 后端                   │ │
│  │  └── copilotRuntimeNodeHttpEndpoint                           │ │
│  │                                                                │ │
│  │  协议转换: Single-Route (前端) ←→ AG-UI SSE (后端)             │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  @copilotkit/runtime v1.54.1 + tsx                                  │
│  Port: 4000                                                         │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ AG-UI Protocol (SSE Events)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       后端服务层 (Python)                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  FastAPI App                                                   │ │
│  │  ├── AG-UI Endpoint (POST /)                                  │ │
│  │  │   └── LangGraphAgent (ag-ui-langgraph)                     │ │
│  │  │       └── LangGraph StateGraph → chat_node                 │ │
│  │  ├── SSE Endpoint (GET /api/process-stream)                   │ │
│  │  │   └── 思维过程广播                                          │ │
│  │  └── Health Endpoint (GET /health)                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  Python 3.12 + FastAPI + copilotkit 0.1.83 + ag-ui-langgraph       │
│  Port: 8000                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

## 三服务架构

本项目采用三服务架构，每个服务承担独立职责：

| 服务 | 技术栈 | 端口 | 职责 |
|------|--------|------|------|
| **Frontend** | React + Vite + CopilotKit | 3000 | 用户界面、聊天交互、思维过程展示 |
| **Runtime** | Node.js + @copilotkit/runtime | 4000 | 协议转换中间件 (Single-Route ↔ AG-UI) |
| **Backend** | Python + FastAPI + LangGraph | 8000 | Agent 执行、LangGraph 编排、SSE 广播 |

### 为什么需要 Runtime 中间层？

CopilotKit v1.54.1 的前端和后端使用不同的通信协议：

- **前端** (`@copilotkit/react-core`) 使用 **Single-Route JSON-RPC** 协议
- **后端** (`ag-ui-langgraph`) 使用 **AG-UI SSE** 协议

Node.js CopilotKit Runtime 作为中间层负责协议转换，使前后端可以独立演化。

## 关键设计决策

### 1. AG-UI 协议 (Agent-User Interaction)

使用 CopilotKit 的 AG-UI 开源协议作为 Agent 通信标准。

**原因：**
- 轻量级、基于事件的协议
- 支持实时 SSE 流式通信
- 前后端解耦，支持多语言后端

### 2. LangGraph 作为 Agent 编排框架

后端使用 LangGraph StateGraph 定义 Agent 逻辑。

**原因：**
- 与 CopilotKit AG-UI 原生集成
- 支持有状态的多轮对话
- 内置 checkpointer 支持对话恢复

### 3. 思维过程独立 SSE 通道

Claude SDK 消息通过独立 SSE 通道 (`/api/process-stream`) 广播到前端 ProcessPanel。

**原因：**
- 分离关注点：交互走 CopilotKit，展示走 ProcessPanel
- 不阻塞主交互流程
- 支持多个前端客户端同时订阅

### 4. 系统提示词预加载

首次对话前，自动加载可配置的系统提示词到 Claude Code。

**配置方式：**
```bash
# .env
SYSTEM_PROMPT_PATH=./system_prompt.md
```

## 技术选型

| 组件 | 技术选择 | 版本 | 原因 |
|------|----------|------|------|
| 前端框架 | React | 18 | CopilotKit 支持 |
| 前端构建 | Vite | 7.x | 快速 HMR |
| CSS 框架 | Tailwind CSS | 3.4 | 快速开发 |
| 前端交互 | CopilotKit | 1.54.1 | AI 聊天组件 |
| Runtime | @copilotkit/runtime | 1.54.1 | 协议转换中间件 |
| 后端框架 | FastAPI | 0.135+ | 异步，自动 API 文档 |
| Agent 编排 | LangGraph | 1.0+ | 状态图 Agent |
| AG-UI 集成 | ag-ui-langgraph | 0.0.28 | LangGraph AG-UI 端点 |
| CopilotKit SDK | copilotkit | 0.1.83 | LangGraphAGUIAgent |
| Claude SDK | claude-agent-sdk | 0.1.51 | Claude Code CLI 集成 |
| Python 版本 | Python | 3.12 | CopilotKit SDK 要求 <3.13 |
| 通信协议 | SSE | - | 实时单向通信 |

## 项目结构

```
claude-code-viewer/
├── README.md
├── .claude/
│   └── CLAUDE.md
│
├── backend/                          # Python 后端 (Port 8000)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI 入口 + AG-UI 端点
│   │   ├── config.py                 # Pydantic Settings 配置
│   │   ├── models.py                 # ProcessMessage 数据模型
│   │   ├── agents/                   # Agent 定义 (预留)
│   │   │   └── claude_code_agent.py
│   │   ├── sdk/                      # Claude SDK 封装 (预留)
│   │   │   └── client.py
│   │   └── api/
│   │       └── process_stream.py     # SSE 思维过程端点
│   ├── system_prompt.md
│   ├── requirements.txt
│   ├── .env.example
│   └── venv/                         # Python 3.12 虚拟环境
│
├── frontend/                         # React 前端 (Port 3000)
│   ├── server/
│   │   └── copilotkit-runtime.ts     # CopilotKit Runtime 服务 (Port 4000)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                   # CopilotKit Provider + 布局
│   │   ├── components/
│   │   │   ├── PhoneFrame.tsx
│   │   │   ├── ProcessPanel.tsx
│   │   │   ├── CopilotChat.tsx
│   │   │   ├── PermissionDialog.tsx
│   │   │   ├── SelectionCard.tsx
│   │   │   └── SummaryCard.tsx
│   │   ├── hooks/
│   │   │   ├── useProcessStream.ts
│   │   │   └── useWebSocket.ts
│   │   └── types/
│   │       └── messages.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── .env
│
└── docs/                             # 设计文档
    ├── index.md
    ├── architecture.md
    ├── runtime.md                    # NEW: Runtime 中间层文档
    ├── backend.md
    ├── frontend.md
    ├── data-flow.md
    ├── configuration.md
    └── copilotkit-integration.md
```
