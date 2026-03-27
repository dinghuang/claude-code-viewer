# 架构设计

## 系统分层架构

```
┌────────────────────────────────────────────────────────────────┐
│                         用户界面层                              │
│  ┌─────────────────────┐   ┌───────────────────────────────┐  │
│  │   PhoneFrame        │   │   ProcessPanel                │  │
│  │   ┌───────────────┐ │   │   (展示完整思维过程)           │  │
│  │   │ CopilotKit    │ │   │   - AssistantMessage          │  │
│  │   │ - Chat        │ │   │   - ToolUseBlock              │  │
│  │   │ - Permission  │ │   │   - ToolResultBlock           │  │
│  │   │ - Selection   │ │   │   - ThinkingBlock             │  │
│  │   │ - Progress    │ │   │   - ResultMessage             │  │
│  │   └───────────────┘ │   │                               │  │
│  └─────────────────────┘   └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       通信协议层                                │
│         CopilotKit AG-UI Protocol (SSE + Events)               │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       后端服务层                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  FastAPI App                                             │  │
│  │  └── CopilotKitRemoteEndpoint                           │  │
│  │       └── ClaudeCodeAgent (CopilotKit Agent)            │  │
│  │            ├── 首次对话加载系统提示词                    │  │
│  │            ├── 消息转发到 Claude SDK                     │  │
│  │            ├── 权限请求 → CopilotKit Action              │  │
│  │            └── 思维过程 → 前端 ProcessPanel              │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       Claude SDK 层                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ClaudeSDKClient (claude-agent-sdk-python)              │  │
│  │  - connect() → 启动 Claude Code CLI                     │  │
│  │  - query() → 发送用户消息                               │  │
│  │  - receive_messages() → 接收 Claude 响应流              │  │
│  │  - can_use_tool callback → 权限请求回调                 │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Claude Code CLI (本地)                      │
│            内置 MCP 服务和 Skills 配置                         │
└────────────────────────────────────────────────────────────────┘
```

## 关键设计决策

### 1. CopilotKit 作为主通信通道

用户输入、权限确认、选择都通过 CopilotKit AG-UI 协议传输。

**原因：**
- CopilotKit 提供完整的 UI 组件和交互协议
- 支持 SSE 实时通信
- 内置 Action 机制处理用户交互

### 2. 思维过程广播

Claude SDK 的所有消息通过独立 SSE 通道广播到前端 ProcessPanel。

**原因：**
- 分离关注点：交互走 CopilotKit，展示走 ProcessPanel
- 不阻塞主交互流程
- 支持多个前端客户端同时订阅

### 3. 权限桥接

Claude SDK 的 `can_use_tool` 回调触发 CopilotKit 的 Action。

**流程：**
1. Claude SDK 检测到需要权限的工具调用
2. 触发 `can_use_tool` 回调
3. Agent 通过 CopilotKit Action 请求前端
4. 前端显示 PermissionCard
5. 用户响应后返回结果给 Claude SDK

### 4. 系统提示词预加载

首次对话前，自动加载可配置的系统提示词到 Claude Code。

**流程：**
1. 用户发送第一条消息
2. Agent 检查是否已加载系统提示词
3. 如果未加载，先发送 `system_prompt.md` 内容给 Claude
4. 然后再转发用户消息

**配置方式：**
```bash
# .env
SYSTEM_PROMPT_PATH=./system_prompt.md
```

### 5. Claude Code CLI 内置能力

Claude Code CLI 已内置 MCP 服务和 Skills 配置，无需在应用层额外配置。

## 技术选型

| 组件 | 技术选择 | 原因 |
|------|----------|------|
| 前端框架 | React 18 | 生态成熟，CopilotKit 支持 |
| 前端构建 | Vite | 快速 HMR，ESM 原生支持 |
| CSS 框架 | Tailwind CSS | 快速开发，响应式设计 |
| 前端交互 | CopilotKit | 丰富的 AI 聊天组件 |
| 后端框架 | FastAPI | 异步支持，自动 API 文档 |
| Claude SDK | claude-agent-sdk-python | 官方 Python SDK |
| CopilotKit SDK | copilotkit | 官方 Python SDK |
| 通信协议 | SSE | 单向实时通信，简单可靠 |

## 项目结构

```
claude-code-viewer/
├── README.md
├── CLAUDE.md
├── docker-compose.yml
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models.py
│   │   ├── agents/
│   │   │   └── claude_code_agent.py
│   │   ├── sdk/
│   │   │   └── client.py
│   │   ├── actions/
│   │   │   ├── permission_action.py
│   │   │   └── selection_action.py
│   │   └── api/
│   │       └── process_stream.py
│   ├── system_prompt.md            # 系统提示词配置
│   ├── requirements.txt
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── chat/
│   │   │   ├── interaction/
│   │   │   └── process/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── package.json
│   └── .env
│
└── docs/
    ├── index.md
    ├── architecture.md
    ├── configuration.md
    ├── backend.md
    ├── frontend.md
    ├── data-flow.md
    └── copilotkit-integration.md
```
