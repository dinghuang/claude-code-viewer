# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI智能投顾 — 基于 Claude Code 的智能投资顾问系统。采用 **3-service architecture**: React frontend (Port 3000) + Node.js CopilotKit Runtime middleware (Port 4000) + Python FastAPI backend (Port 8000)。通过 6 个金融 MCP 服务器提供实时行情、基金研究、ETF 榜单、新闻资讯等专业投资分析能力。

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
| [数据流设计](docs/data-flow.md) | AG-UI 事件流、双通道数据流、权限处理、Session 复用 | `docs/data-flow.md` |
| [配置管理](docs/configuration.md) | 三个服务的环境变量、用户信息 + 系统提示词配置 | `docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](docs/backend.md) | Python FastAPI + LangGraph + AG-UI + Session 复用 | `docs/backend.md` |
| [Runtime 中间层](docs/runtime.md) | Node.js CopilotKit Runtime 协议转换 | `docs/runtime.md` |
| [前端设计](docs/frontend.md) | React + CopilotKit + 设置面板左右布局 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](docs/copilotkit-integration.md) | CopilotKit v1.54.1 三层集成 + threadId 复用 | `docs/copilotkit-integration.md` |
| [MCP 服务器配置](docs/mcp.md) | 6 个 MCP 服务器：金融数据、新闻搜索、网页研究 | `docs/mcp.md` |

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
- Claude Agent SDK (支持 session resume)
- SSE (sse-starlette)
- 6 个金融 MCP 服务器

---

## Development Commands

### Backend (from `backend/`)
```bash
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend + Runtime (from `frontend/`)
```bash
npm install
cp .env.example .env
npm run dev          # Start Vite dev server (Port 3000)
npm run dev:runtime  # Start CopilotKit Runtime (Port 4000)
npm run dev:all      # Start both frontend + runtime
npm run build        # Build for production
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
- `main.py` - FastAPI entry + AG-UI endpoint + REST API (user-info, system-prompt, permission-mode)
- `config.py` - Pydantic settings with system_prompt_path + user_info_path
- `models.py` - ProcessMessage model for SSE stream
- `api/process_stream.py` - SSE endpoint for thinking process broadcast
- `agents/claude_code_agent.py` - LangGraph Agent (4 nodes: prepare/execute/permission_check/collect), session reuse via `claude_session_id`
- `sdk/client.py` - `build_claude_options()` helper + MCP server config
- `system_prompt.md` - AI投顾系统提示词 (投资研究技能)
- `user_info.md` - 用户画像 (客户资产/偏好)

### Runtime (`frontend/server/`)
- `copilotkit-runtime.ts` - CopilotKit Runtime server (Node.js)
  - `CopilotRuntime` + `ExperimentalEmptyAdapter`
  - `LangGraphHttpAgent` → forwards to Python backend

### Frontend Structure (`frontend/src/`)
- `App.tsx` - CopilotKit provider + threadId (session reuse) + data fetch on mount
- `components/SystemPromptPanel.tsx` - Left-right layout settings modal (1200px): user info + system prompt | permission modes
- `components/PhoneFrame.tsx` - Phone mockup with 24h live clock
- `components/ProcessPanel.tsx` - Thinking process display (SSE → port 8000)
- `components/PermissionDialog.tsx` - Permission card for LangGraph interrupt
- `hooks/useProcessStream.ts` - SSE subscription hook

### Communication Flow
1. User input → CopilotKit Chat → Single-Route POST to Runtime (4000)
2. Runtime → AG-UI POST to Backend (8000)
3. Backend LangGraph: prepare → execute (`claude_agent_sdk.query()` with session resume) → permission_check → collect
4. Execute node streams SDK messages → SSE broadcast → Frontend ProcessPanel
5. Collect node returns AIMessage → AG-UI → Runtime → CopilotChat
6. Settings: Frontend fetches user_info.md + system_prompt.md → edits → POST combined to Backend

### Session Reuse
- Frontend: stable `SESSION_THREAD_ID` per page load → same LangGraph thread
- Backend: `claude_session_id` in State → `ClaudeAgentOptions(resume=session_id)`
- Page refresh → new threadId → new session

---

## Environment Variables

### Backend (.env)
```bash
# Required
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_AUTH_TOKEN=your_auth_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# File paths
SYSTEM_PROMPT_PATH=./system_prompt.md
USER_INFO_PATH=./user_info.md

# MCP servers (JSON string)
CLAUDE_CODE_MCP_SERVERS={"webresearch":{...},"qieman":{...},...}

# Optional
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
VITE_API_URL=http://localhost:8000                    # For SSE stream + REST API
VITE_COPILOTKIT_RUNTIME_URL=http://localhost:4000     # For CopilotKit
```

---

## Key Files to Reference

| Task | Key Files |
|------|-----------|
| Modify backend Agent logic / session reuse | `backend/app/agents/claude_code_agent.py` |
| Modify backend API / endpoints | `backend/app/main.py` |
| Modify system prompt / user info handling | `backend/app/agents/claude_code_agent.py`, `backend/app/config.py` |
| Edit user profile content | `backend/user_info.md` |
| Edit system prompt content | `backend/system_prompt.md` |
| Add configuration | `backend/app/config.py`, `backend/.env.example` |
| Modify Runtime | `frontend/server/copilotkit-runtime.ts` |
| Modify frontend layout / session | `frontend/src/App.tsx` |
| Modify settings panel | `frontend/src/components/SystemPromptPanel.tsx` |
| Modify process panel | `frontend/src/components/ProcessPanel.tsx`, `frontend/src/hooks/useProcessStream.ts` |
| Modify permission UI | `frontend/src/components/PermissionDialog.tsx` |
| Update types | `frontend/src/types/messages.ts`, `backend/app/models.py` |
| MCP server config | `backend/.env` (CLAUDE_CODE_MCP_SERVERS), `docs/mcp.md` |

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
