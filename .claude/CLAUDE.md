# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Viewer is a web application for visualizing Claude Code execution processes. It features a dual-pane interface: a phone-frame UI on the left (CopilotKit-style interaction) and a thinking process panel on the right (SSE stream).

**重要：收到用户需求后，请先查阅文档索引找到相关知识作为上下文。**

---

## 文档索引

项目设计文档位于 `docs/` 目录，以下是索引：

### 核心设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [架构设计](docs/architecture.md) | 系统整体架构和技术选型 | `docs/architecture.md` |
| [数据流设计](docs/data-flow.md) | 消息流向和处理流程 | `docs/data-flow.md` |
| [配置管理](docs/configuration.md) | 环境变量、系统提示词配置 | `docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](docs/backend.md) | Python FastAPI 后端模块设计 | `docs/backend.md` |
| [前端设计](docs/frontend.md) | React + CopilotKit 前端组件设计 | `docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](docs/copilotkit-integration.md) | CopilotKit 集成说明 | `docs/copilotkit-integration.md` |

---

## 技术栈

### 前端
- React 18 + Vite + Tailwind CSS
- CopilotKit React (`@copilotkit/react-core`, `@copilotkit/react-ui`)

### 后端
- Python FastAPI
- Claude Agent SDK (`claude-agent-sdk-python`)
- CopilotKit SDK (`copilotkit`)
- SSE (Server-Sent Events) via `sse-starlette`

---

## Development Commands

### Backend (from `backend/`)
```bash
# Create and activate virtual environment first
python -m venv venv
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn app.main:app --reload --port 8000
```

### Frontend (from `frontend/`)
```bash
npm install
cp .env.example .env
npm run dev      # Start development server (Vite)
npm run build    # Build for production
npm run lint     # Run ESLint
```

---

## Architecture Overview

### Backend Structure (`backend/app/`)
- `main.py` - FastAPI entry point + CopilotKit integration
- `config.py` - Pydantic settings with system prompt loading
- `models.py` - ProcessMessage model for SSE stream
- `agents/claude_code_agent.py` - CopilotKit Agent bridging to Claude SDK
- `sdk/client.py` - Claude SDK client wrapper
- `api/process_stream.py` - SSE endpoint for thinking process

### Frontend Structure (`frontend/src/`)
- `App.tsx` - CopilotKit provider with dual-pane layout
- `components/PhoneFrame.tsx` - Phone mockup container
- `components/ProcessPanel.tsx` - Thinking process display (SSE)
- `hooks/useProcessStream.ts` - SSE subscription hook
- `types/messages.ts` - ProcessMessage type definitions

### Communication Flow
1. User input → CopilotKit UI → `/copilotkit` endpoint
2. `ClaudeCodeAgent.execute()` → Claude SDK Client
3. Claude SDK → Claude Code CLI (local)
4. Thinking process → SSE broadcast → Frontend ProcessPanel
5. Permission requests → CopilotKit Actions → User interaction

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

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8000
```

---

## Tool Risk Levels

Defined in `agents/claude_code_agent.py`:
- **LOW**: read, ls, glob, grep, search, web_fetch, web_search (auto-approved)
- **MEDIUM**: git, npm, pip, mkdir, mv (requires confirmation)
- **HIGH**: Bash, Write, Edit, rm, delete, sudo (requires explicit approval)

---

## Key Files to Reference

When working on specific tasks, refer to:

| Task | Key Files |
|------|-----------|
| Modify backend API | `backend/app/main.py`, `backend/app/api/` |
| Modify agent behavior | `backend/app/agents/claude_code_agent.py` |
| Add configuration | `backend/app/config.py`, `backend/.env.example` |
| Modify frontend layout | `frontend/src/App.tsx`, `frontend/src/components/PhoneFrame.tsx` |
| Modify process panel | `frontend/src/components/ProcessPanel.tsx`, `frontend/src/hooks/useProcessStream.ts` |
| Update types | `frontend/src/types/messages.ts`, `backend/app/models.py` |

---

## Dependencies

### Backend (Python)
- `fastapi>=0.115.0`
- `copilotkit>=0.1.0`
- `langgraph>=0.3.25`
- `langchain>=0.3.0`
- `sse-starlette>=1.8.0`

### Frontend (Node.js)
- `@copilotkit/react-core`
- `@copilotkit/react-ui`
- `react`, `react-dom`
- `tailwindcss`