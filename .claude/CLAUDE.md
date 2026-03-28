# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Viewer is a web application for visualizing Claude Code execution processes. It uses a **3-service architecture**: React frontend (Port 3000) + Node.js CopilotKit Runtime middleware (Port 4000) + Python FastAPI backend (Port 8000).

**重要：收到用户需求后，请先查阅文档索引找到相关知识作为上下文。**

---

## MCP 工具使用指南

| 场景 | 推荐工具 | 说明 |
|------|----------|------|
| 搜索代码案例 | `mcp__github__search_code` | 在 GitHub 上搜索代码示例和实现参考 |
| 搜索互联网信息 | `mcp__webresearch__search_google` / `mcp__webresearch__visit_page` | 搜索技术文档、API 参考、最佳实践等 |

---

## 文档索引

项目设计文档位于 `docs/` 目录，以下是索引：

### 核心设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [架构设计](docs/architecture.md) | 三服务架构、技术选型、项目结构 | `docs/architecture.md` |
| [数据流设计](docs/data-flow.md) | AG-UI 事件流、双通道数据流、权限处理 | `docs/data-flow.md` |
| [配置管理](docs/configuration.md) | 三个服务的环境变量、系统提示词配置 | `docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](docs/backend.md) | Python FastAPI + LangGraph + AG-UI 端点 | `docs/backend.md` |
| [Runtime 中间层](docs/runtime.md) | Node.js CopilotKit Runtime 协议转换 | `docs/runtime.md` |
| [前端设计](docs/frontend.md) | React + CopilotKit + Tailwind CSS 组件 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](docs/copilotkit-integration.md) | CopilotKit v1.54.1 三层集成说明 | `docs/copilotkit-integration.md` |

---

## 技术栈

### 前端 (Port 3000)
- React 18 + Vite + Tailwind CSS
- CopilotKit v1.54.1 (`@copilotkit/react-core`, `@copilotkit/react-ui`)

### Runtime 中间层 (Port 4000)
- Node.js + `@copilotkit/runtime` v1.54.1
- 协议转换: Single-Route JSON-RPC ↔ AG-UI SSE

### 后端 (Port 8000)
- Python 3.12 + FastAPI
- LangGraph 1.0+ + ag-ui-langgraph 0.0.28
- copilotkit 0.1.83
- Claude Agent SDK
- SSE (sse-starlette)

---

## Development Commands

### Backend (from `backend/`)
```bash
# Requires Python 3.12 (copilotkit SDK requires <3.13)
python3.12 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload --port 8000
```

### Runtime (from `frontend/`)
```bash
npx tsx server/copilotkit-runtime.ts
# Or: npm run dev:runtime
```

### Frontend (from `frontend/`)
```bash
npm install
cp .env.example .env
npm run dev          # Start Vite dev server (Port 3000)
npm run dev:runtime  # Start CopilotKit Runtime (Port 4000)
npm run dev:all      # Start both frontend + runtime
npm run build        # Build for production
npm run lint         # Run ESLint
```

---

## Architecture Overview

### 3-Service Architecture
```
Frontend (3000)  →  Runtime (4000)  →  Backend (8000)
React+CopilotKit    Node.js Middleware   Python+LangGraph
Single-Route        Protocol Bridge      AG-UI SSE
```

### Backend Structure (`backend/app/`)
- `main.py` - FastAPI entry + AG-UI endpoint + system prompt REST API
- `config.py` - Pydantic settings with system prompt file loading
- `models.py` - ProcessMessage model for SSE stream
- `api/process_stream.py` - SSE endpoint for thinking process
- `agents/claude_code_agent.py` - LangGraph Agent (prepare/execute/collect nodes), calls `claude_agent_sdk.query()`
- `sdk/client.py` - `build_claude_options()` helper

### Runtime (`frontend/server/`)
- `copilotkit-runtime.ts` - CopilotKit Runtime server (Node.js)
  - `CopilotRuntime` + `ExperimentalEmptyAdapter`
  - `LangGraphHttpAgent` → forwards to Python backend

### Frontend Structure (`frontend/src/`)
- `App.tsx` - CopilotKit provider + system prompt state + dual-pane layout (shrink-0 phone / flex-1 panel)
- `components/PhoneFrame.tsx` - Phone mockup with 24h live clock
- `components/SystemPromptPanel.tsx` - Floating gear button + modal prompt editor
- `components/ProcessPanel.tsx` - Thinking process display (SSE → port 8000)
- `components/PermissionDialog.tsx` - Permission card for CopilotKit Action
- `hooks/useProcessStream.ts` - SSE subscription hook

### Communication Flow
1. User input → CopilotKit Chat → Single-Route POST to Runtime (4000)
2. Runtime → AG-UI POST to Backend (8000)
3. Backend LangGraph: prepare → execute (`claude_agent_sdk.query()`) → collect
4. Execute node streams SDK messages → SSE broadcast → Frontend ProcessPanel
5. Collect node returns AIMessage → AG-UI → Runtime → CopilotChat
6. System prompt: Frontend editor → `POST /api/system-prompt` → Backend memory

---

## Environment Variables

### Backend (.env)
```bash
# Required
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_AUTH_TOKEN=your_auth_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# Optional
SYSTEM_PROMPT_PATH=./system_prompt.md
COPILOTKIT_LLM_API_KEY=your_api_key
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5
```

### Runtime (env vars)
```bash
AGENT_URL=http://localhost:8000     # Python backend URL
RUNTIME_PORT=4000                   # Runtime listen port
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8000                    # For SSE stream
VITE_COPILOTKIT_RUNTIME_URL=http://localhost:4000     # For CopilotKit
```

---

## Key Files to Reference

| Task | Key Files |
|------|-----------|
| Modify backend Agent logic | `backend/app/agents/claude_code_agent.py` |
| Modify backend API / endpoints | `backend/app/main.py` |
| Modify system prompt handling | `backend/app/agents/claude_code_agent.py` (get_effective_system_prompt) |
| Add configuration | `backend/app/config.py`, `backend/.env.example` |
| Modify Runtime | `frontend/server/copilotkit-runtime.ts` |
| Modify frontend layout | `frontend/src/App.tsx`, `frontend/src/components/PhoneFrame.tsx` |
| Modify system prompt editor | `frontend/src/components/SystemPromptPanel.tsx` |
| Modify process panel | `frontend/src/components/ProcessPanel.tsx`, `frontend/src/hooks/useProcessStream.ts` |
| Modify permission UI | `frontend/src/components/PermissionDialog.tsx` |
| Update types | `frontend/src/types/messages.ts`, `backend/app/models.py` |

---

## Dependencies

### Backend (Python 3.12)
- `fastapi>=0.115.0`
- `copilotkit>=0.1.83`
- `ag-ui-langgraph>=0.0.27`
- `langgraph>=1.0.0`
- `langchain-core>=1.2.0`
- `claude-agent-sdk>=0.1.0`
- `sse-starlette>=1.8.0`

### Frontend (Node.js)
- `@copilotkit/react-core` ^1.54.1
- `@copilotkit/react-ui` ^1.54.1
- `@copilotkit/runtime` ^1.54.1
- `react`, `react-dom` ^18
- `tailwindcss` ^3.4
- `tsx`, `reflect-metadata` (for Runtime)
