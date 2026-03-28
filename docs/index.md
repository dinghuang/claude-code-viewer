# Claude Code Viewer 设计文档

一个用于可视化 Claude Code 执行过程的 Web 应用，采用三服务架构：React 前端 + Node.js CopilotKit Runtime 中间层 + Python FastAPI 后端。

## 文档索引

### 核心设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [架构设计](architecture.md) | 三服务架构、技术选型、项目结构 | `docs/architecture.md` |
| [数据流设计](data-flow.md) | AG-UI 事件流、双通道数据流、权限处理 | `docs/data-flow.md` |
| [配置管理](configuration.md) | 三个服务的环境变量、系统提示词配置 | `docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](backend.md) | Python FastAPI + LangGraph + AG-UI 端点 | `docs/backend.md` |
| [Runtime 中间层](runtime.md) | Node.js CopilotKit Runtime 协议转换 | `docs/runtime.md` |
| [前端设计](frontend.md) | UI 设计系统、卡片渲染、权限卡片、设置浮窗 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](copilotkit-integration.md) | CopilotKit v1.54.1 三层集成说明 | `docs/copilotkit-integration.md` |
| [MCP 服务器配置](mcp.md) | 6 个 MCP 服务器：金融数据、新闻搜索、网页研究 | `docs/mcp.md` |

## 快速开始

### 环境要求

- **Python**: 3.10 - 3.12 (不支持 3.13+)
- **Node.js**: 18+
- **Claude Code CLI**: 已安装并配置

### 启动三个服务

```bash
# 终端 1: 后端 (Port 8000)
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# 终端 2: CopilotKit Runtime (Port 4000)
cd frontend
npx tsx server/copilotkit-runtime.ts

# 终端 3: 前端 (Port 3000)
cd frontend
npm run dev
```

或使用 npm script 同时启动前端和 Runtime：

```bash
# 终端 1: 后端
cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000

# 终端 2: 前端 + Runtime
cd frontend && npm run dev:all
```

访问 http://localhost:3000

## 架构概览

```
Frontend (3000)  →  Runtime (4000)  →  Backend (8000)
React+CopilotKit    Node.js Middleware   Python+LangGraph
Single-Route        协议转换              AG-UI SSE
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
- LangGraph 1.0+ (Agent 编排: prepare → execute → collect)
- ag-ui-langgraph 0.0.28 (AG-UI 端点)
- claude-agent-sdk 0.1.51 (调用 Claude Code CLI)
- copilotkit 0.1.83
- SSE (思维过程广播)

## 主要功能

- **Claude Code CLI 集成**: 后端通过 `claude_agent_sdk.query()` 调用真实 Claude Code CLI
- **实时思维过程**: SSE 广播 Claude 的思考、工具调用、结果到右侧面板
- **Markdown 卡片化**: 表格渲染为圆角卡片 (斑马纹 + hover)，代码块/引用块也有卡片样式
- **权限交互卡片**: 默认模式下工具被拒时，CopilotChat 中显示 PermissionCard（LangGraph interrupt），用户可"允许并重试"
- **设置浮窗**: 左下角齿轮按钮打开 Modal，可配置权限模式 (4 种) 和系统提示词
- **Indigo 主题**: 用户消息蓝紫渐变气泡、Indigo 聚焦光晕、柔和配色
- **24 小时实时时钟**: 手机框架状态栏
- **响应式布局**: 左侧手机固定宽度，右侧面板自适应填满
