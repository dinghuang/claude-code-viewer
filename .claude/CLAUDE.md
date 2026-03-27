# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Viewer is a web application for visualizing Claude Code execution processes. It features a dual-pane interface: a phone-frame UI on the left (beautified CopilotKit-style interaction) and a raw message stream panel on the right.

## Development Commands

### Frontend (from `frontend/`)
```bash
npm run dev      # Start development server (Vite)
npm run build    # Build for production (TypeScript + Vite)
npm run lint     # Run ESLint
```

### Backend (from `backend/`)
```bash
# Create and activate virtual environment first
python -m venv venv
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Architecture

### Frontend-Backend Communication
- WebSocket connection at `/ws` endpoint
- Frontend uses `useWebSocket` hook with auto-reconnect (exponential backoff, max 10 attempts)
- Messages are queued when disconnected and sent after reconnection

### Backend Structure (`backend/app/`)
- `main.py` - FastAPI app with CORS middleware, lifespan management
- `ws.py` - WebSocket endpoint, `ConnectionManager` for connections, permission/selection request handling with timeout (60s default)
- `agents.py` - `ClaudeCodeAgent` class simulates Claude Code CLI interaction with state machine (IDLE → PROCESSING → WAITING_PERMISSION/WAITING_SELECTION → IDLE)
- `models.py` - Pydantic models for messages, permission/selection requests/responses

### Message Flow
1. User sends task via `start_task` message type
2. Agent processes and may emit: `message`, `permission_request`, `selection_request`, `summary`
3. Frontend responds with `permission_response` or `selection_response`
4. Backend uses `asyncio.Future` to wait for user responses with timeout

### Tool Risk Levels
Defined in `agents.py`:
- LOW: read, ls, glob, grep, search, web_fetch, web_search
- MEDIUM: write, edit, mkdir, git, npm, pip
- HIGH: exec, shell, rm, delete, sudo

### Frontend Structure (`frontend/src/`)
- `App.tsx` - Main layout with responsive design (mobile tab switch, desktop split view)
- `components/PhoneFrame.tsx` - Phone mockup container
- `components/CopilotChat.tsx` - Beautified chat interface
- `components/ProcessPanel.tsx` - Raw message stream display
- `components/PermissionDialog.tsx` - Permission approval UI
- `components/SelectionCard.tsx` - Selection UI
- `components/SummaryCard.tsx` - Task summary display
- `hooks/useWebSocket.ts` - WebSocket hook with reconnection logic

## Environment Variables

Frontend:
- `VITE_WS_URL` - WebSocket URL (default: `ws://localhost:8000/ws`)

Backend:
- `GLM_API_URL` - GLM API URL (for local model)
- `GLM_API_KEY` - API key
