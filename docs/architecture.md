# 架构设计

## 系统分层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户界面层 (Frontend)                        │
│  ┌─────────────────────┐   ┌──────────────────────────────────────┐ │
│  │   PhoneFrame        │   │   ProcessPanel                       │ │
│  │   ┌───────────────┐ │   │   (展示完整思维过程 - SSE 流)         │ │
│  │   │ CopilotKit    │ │   │   - ThinkingBlock (思考过程)          │ │
│  │   │ - CopilotChat │ │   │   - ToolUseBlock (工具调用)           │ │
│  │   │ - Permission  │ │   │   - ToolResultBlock (工具结果)        │ │
│  │   │   Card        │ │   │   - ResultMessage (执行结果)          │ │
│  │   └───────────────┘ │   │                                     │ │
│  └─────────────────────┘   └──────────────────────────────────────┘ │
│  SettingsPanel: 左右分栏 (用户信息+提示词 | 权限模式)                  │
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
│  │  │   └── LangGraphAgent → StateGraph                          │ │
│  │  │       ├── prepare_node (加载系统提示词)                      │ │
│  │  │       ├── execute_node (claude_agent_sdk.query + session复用)│ │
│  │  │       ├── permission_check_node (权限中断)                  │ │
│  │  │       └── collect_node (结果包装为 AIMessage)                │ │
│  │  ├── SSE Endpoint (GET /api/process-stream)                   │ │
│  │  ├── REST: /api/user-info, /api/system-prompt                 │ │
│  │  └── REST: /api/permission-mode, /health                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│  Python 3.12 + FastAPI + claude-agent-sdk + 6 个金融 MCP 服务器      │
│  Port: 8000                                                         │
└──────────────────────────────────────────────────────────────────────┘
```

## 三服务架构

| 服务 | 技术栈 | 端口 | 职责 |
|------|--------|------|------|
| **Frontend** | React + Vite + CopilotKit | 3000 | 用户界面、AI 对话、设置面板、思维过程展示 |
| **Runtime** | Node.js + @copilotkit/runtime | 4000 | 协议转换中间件 (Single-Route ↔ AG-UI) |
| **Backend** | Python + FastAPI + LangGraph | 8000 | Agent 执行、Session 管理、SSE 广播、MCP 工具调用 |

### 为什么需要 Runtime 中间层？

CopilotKit v1.54.1 的前端和后端使用不同的通信协议：

- **前端** (`@copilotkit/react-core`) 使用 **Single-Route JSON-RPC** 协议
- **后端** (`ag-ui-langgraph`) 使用 **AG-UI SSE** 协议

Node.js CopilotKit Runtime 作为中间层负责协议转换，使前后端可以独立演化。

## 关键设计决策

### 1. AG-UI 协议 (Agent-User Interaction)

使用 CopilotKit 的 AG-UI 开源协议作为 Agent 通信标准。

- 轻量级、基于事件的协议
- 支持实时 SSE 流式通信
- 前后端解耦，支持多语言后端

### 2. LangGraph 作为 Agent 编排框架

后端使用 LangGraph StateGraph 定义 Agent 逻辑 (4 节点)。

- 与 CopilotKit AG-UI 原生集成
- 支持有状态的多轮对话 (MemorySaver checkpointer)
- 内置 `interrupt()` 支持权限审批流程

### 3. Session 复用

Claude Agent SDK 的 `resume` 参数实现 session 复用：

- 首次对话创建新 session，从 `SystemMessage(init)` 捕获 `session_id`
- 后续对话通过 `ClaudeAgentOptions(resume=session_id)` 复用同一 session
- 页面刷新时前端生成新 `threadId`，LangGraph 创建新 thread，自然创建新 session

### 4. 思维过程独立 SSE 通道

Claude SDK 消息通过独立 SSE 通道 (`/api/process-stream`) 广播到前端 ProcessPanel。

- 分离关注点：交互走 CopilotKit，展示走 ProcessPanel
- 不阻塞主交互流程
- 支持多个前端客户端同时订阅

### 5. 用户信息与系统提示词分离

用户画像 (`user_info.md`) 和系统提示词 (`system_prompt.md`) 独立存储：

- 前端加载时从后端文件 API 获取
- 设置面板中分别编辑，保存时拼接为完整提示词
- 刷新页面重置为文件内容，保存仅做前端缓存

### 6. 金融 MCP 工具链

6 个 MCP 服务器覆盖完整投研流程：

```
实时数据 → sina_finance (行情、汇率)
基金投顾 → qieman (基金详情、资产配置、PDF 报告)
ETF 榜单 → gf_etfrank (涨跌榜、资金流向)
深度研究 → datayes (研报、财报、会议纪要)
新闻资讯 → caixin_content (财新高质量新闻)
互联网补充 → webresearch (Google 搜索、网页提取)
```

## 技术选型

| 组件 | 技术选择 | 版本 | 原因 |
|------|----------|------|------|
| 前端框架 | React | 18 | CopilotKit 支持 |
| 前端构建 | Vite | 7.x | 快速 HMR |
| CSS 框架 | Tailwind CSS | 3.4 | 快速开发 |
| 前端交互 | CopilotKit | 1.54.1 | AI 聊天组件 |
| Runtime | @copilotkit/runtime | 1.54.1 | 协议转换中间件 |
| 后端框架 | FastAPI | 0.115+ | 异步，自动 API 文档 |
| Agent 编排 | LangGraph | 1.0+ | 状态图 Agent + interrupt |
| AG-UI 集成 | ag-ui-langgraph | 0.0.28 | LangGraph AG-UI 端点 |
| CopilotKit SDK | copilotkit | 0.1.83 | Python AG-UI 集成 |
| Claude SDK | claude-agent-sdk | 0.1+ | Claude Code CLI 集成 |
| Python 版本 | Python | 3.12 | CopilotKit SDK 要求 <3.13 |
| 通信协议 | SSE | - | 实时单向通信 |

## 项目结构

```
claude-code-viewer/
├── .claude/
│   ├── CLAUDE.md                         # Claude Code 项目指引
│   ├── settings.local.json               # Claude Code 权限设置
│   └── skills/
│       └── investment-research.md        # 投资研究技能定义
│
├── backend/                              # Python 后端 (Port 8000)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI 入口 + AG-UI 端点 + REST API
│   │   ├── config.py                     # Pydantic Settings (含 user_info_path)
│   │   ├── models.py                     # ProcessMessage 数据模型
│   │   ├── agents/
│   │   │   └── claude_code_agent.py      # LangGraph Agent (4 nodes + session 复用)
│   │   ├── sdk/
│   │   │   └── client.py                 # build_claude_options() + MCP 配置
│   │   └── api/
│   │       └── process_stream.py         # SSE 思维过程广播
│   ├── system_prompt.md                  # 系统提示词 (投资研究技能)
│   ├── user_info.md                      # 用户画像 (客户资产/偏好)
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/                             # React 前端 (Port 3000)
│   ├── server/
│   │   └── copilotkit-runtime.ts         # CopilotKit Runtime (Port 4000)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                       # CopilotKit Provider + threadId + 数据加载
│   │   ├── index.css                     # Tailwind + CopilotKit 主题覆盖
│   │   ├── components/
│   │   │   ├── PhoneFrame.tsx            # iPhone 框架 (24h 时钟)
│   │   │   ├── ProcessPanel.tsx          # 思维过程面板 (SSE)
│   │   │   ├── SystemPromptPanel.tsx     # 设置面板 (左右分栏 1200px)
│   │   │   └── PermissionDialog.tsx      # 权限审批卡片
│   │   ├── hooks/
│   │   │   └── useProcessStream.ts       # SSE 订阅 Hook
│   │   └── types/
│   │       └── messages.ts               # ProcessMessage 类型
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
└── docs/                                 # 设计文档
    ├── index.md                          # 文档索引 + 快速开始
    ├── architecture.md                   # 架构设计
    ├── data-flow.md                      # 数据流设计
    ├── backend.md                        # 后端设计
    ├── frontend.md                       # 前端设计
    ├── runtime.md                        # Runtime 中间层
    ├── configuration.md                  # 配置管理
    ├── copilotkit-integration.md         # CopilotKit 集成
    └── mcp.md                            # MCP 服务器配置
```
