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
| [前端设计](frontend.md) | React + CopilotKit + Tailwind CSS 组件 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](copilotkit-integration.md) | CopilotKit v1.54.1 三层集成说明 | `docs/copilotkit-integration.md` |

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

### Runtime 中��层 (Port 4000)
- Node.js + `@copilotkit/runtime` v1.54.1
- 协议转换: Single-Route ↔ AG-UI

### 后端 (Port 8000)
- Python 3.12 + FastAPI
- LangGraph 1.0+ (Agent 编排)
- ag-ui-langgraph 0.0.28 (AG-UI 端点)
- copilotkit 0.1.83
- Claude Agent SDK
- SSE (思维过程广播)
