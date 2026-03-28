# AI智能投顾 设计文档

基于 Claude Code 的 AI 智能投资顾问系统，采用三服务架构：React 前端 + Node.js CopilotKit Runtime 中间层 + Python FastAPI 后端。通过 6 个金融 MCP 服务器提供实时行情、基金研究、ETF 榜单、新闻资讯等专业投资分析能力。

## 文档索引

### 核心设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [架构设计](architecture.md) | 三服务架构、技术选型、项目结构 | `docs/architecture.md` |
| [数据流设计](data-flow.md) | AG-UI 事件流、双通道数据流、权限处理、Session 复用 | `docs/data-flow.md` |
| [配置管理](configuration.md) | 三个服务的环境变量、用户信息 + 系统提示词配置 | `docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](backend.md) | Python FastAPI + LangGraph + AG-UI + Session 复用 | `docs/backend.md` |
| [Runtime 中间层](runtime.md) | Node.js CopilotKit Runtime 协议转换 | `docs/runtime.md` |
| [前端设计](frontend.md) | React + CopilotKit + 设置面板左右布局 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](copilotkit-integration.md) | CopilotKit v1.54.1 三层集成 + threadId 复用 | `docs/copilotkit-integration.md` |
| [MCP 服务器配置](mcp.md) | 6 个 MCP 服务器：金融数据、新闻搜索、网页研究 | `docs/mcp.md` |

## 快速开始

### 环境要求

- **Python**: 3.10 - 3.12 (copilotkit SDK 不支持 3.13+)
- **Node.js**: 18+
- **Claude Code CLI**: 已安装并配置

### 启动三个服务

```bash
# 终端 1: 后端 (Port 8000)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 终端 2: 前端 + Runtime (Port 3000 + 4000)
cd frontend
npm run dev:all
```

访问 http://localhost:3000

## 架构概览

```
Frontend (3000)  →  Runtime (4000)  →  Backend (8000)
React+CopilotKit    Node.js Middleware   Python+LangGraph
Single-Route        协议转换              AG-UI SSE
```

### 双通道数据流

```
通道 1 (对话): CopilotChat → Runtime → Backend LangGraph → claude_agent_sdk.query()
通道 2 (思维): Backend SSE broadcast → Frontend ProcessPanel (直连 8000)
```

## 技术栈

### 前端 (Port 3000)
- React 18 + Vite + Tailwind CSS
- CopilotKit v1.54.1 (`@copilotkit/react-core`, `@copilotkit/react-ui`)

### Runtime 中间层 (Port 4000)
- Node.js + `@copilotkit/runtime` v1.54.1
- 协议转换: Single-Route ↔ AG-UI

### 后端 (Port 8000)
- Python 3.12 + FastAPI
- LangGraph 1.0+ (Agent 编排: prepare → execute → permission_check → collect)
- ag-ui-langgraph 0.0.28 (AG-UI 端点)
- claude-agent-sdk (调用 Claude Code CLI，支持 session 复用)
- copilotkit 0.1.83
- SSE (思维过程广播)

### MCP 服务器 (6 个)
- sina_finance (实时行情/汇率)、qieman (基金/投顾)、gf_etfrank (ETF 榜单)
- datayes (研报/财报)、caixin_content (财新新闻)、webresearch (网页搜索)

## 主要功能

- **AI 智能投顾**: 专业投资研究助手，基于用户画像提供个性化投资分析
- **Claude Code CLI 集成**: 后端通过 `claude_agent_sdk.query()` 调用真实 Claude Code CLI
- **Session 复用**: 同一页面会话内复用 Claude Code session，保持对话上下文
- **实时思维过程**: SSE 广播 Claude 的思考、工具调用、结果到右侧面板
- **6 个金融 MCP 工具**: 实时行情、基金分析、ETF 榜单、研报搜索、财经新闻、网页研究
- **权限交互卡片**: 工具被拒时显示 PermissionCard，用户可"允许并重试"
- **设置面板**: 左右分栏布局 — 左侧用户信息 + 系统提示词，右侧权限模式
- **用户信息 + 系统提示词分离**: 从后端文件加载，前端可编辑，拼接后送给 Agent
- **Indigo 主题**: 蓝紫渐变气泡、Markdown 卡片化渲染
- **24 小时实时时钟**: 手机框架状态栏
- **响应式布局**: 左侧手机固定宽度，右侧面板自适应填满
