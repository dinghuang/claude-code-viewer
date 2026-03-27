# Claude Code Viewer Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Claude Code Viewer to use official claude-agent-sdk-python and CopilotKit for a full-stack AI interaction experience.

**Architecture:** Backend uses FastAPI with CopilotKitRemoteEndpoint bridging to Claude SDK Client. Frontend uses CopilotKit React components for user interaction, with a separate ProcessPanel showing Claude's thinking process via SSE.

**Tech Stack:** Python FastAPI, claude-agent-sdk-python, copilotkit, React 18, Vite, Tailwind CSS, CopilotKit React

---

## File Structure

### Backend Files

```
backend/
├── app/
│   ├── __init__.py              # Package init
│   ├── main.py                  # FastAPI entry + CopilotKit integration
│   ├── config.py                # Pydantic settings
│   ├── models.py                # Data models
│   ├── agents/
│   │   ├── __init__.py
│   │   └── claude_code_agent.py # CopilotKit Agent
│   ├── sdk/
│   │   ├── __init__.py
│   │   └── client.py            # Claude SDK wrapper
│   ├── actions/
│   │   ├── __init__.py
│   │   ├── permission_action.py
│   │   └── selection_action.py
│   └── api/
│       ├── __init__.py
│       └── process_stream.py    # SSE stream
├── system_prompt.md             # System prompt config
├── requirements.txt
├── pyproject.toml
├── .env.example
└── .env
```

### Frontend Files

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── PhoneFrame.tsx
│   │   │   └── SplitPane.tsx
│   │   ├── chat/
│   │   │   ├── CopilotChat.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── ChatInput.tsx
│   │   ├── interaction/
│   │   │   ├── PermissionCard.tsx
│   │   │   ├── SelectionCard.tsx
│   │   │   ├── ProgressCard.tsx
│   │   │   └── SummaryCard.tsx
│   │   └── process/
│   │       ├── ProcessPanel.tsx
│   │       ├── ThinkingBlock.tsx
│   │       ├── ToolUseBlock.tsx
│   │       └── ToolResultBlock.tsx
│   ├── hooks/
│   │   ├── useProcessStream.ts
│   │   └── useCopilotActions.ts
│   ├── lib/
│   │   ├── copilotkit.ts
│   │   └── api.ts
│   └── types/
│       └── messages.ts
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── .env
```

---

## Chunk 1: Backend Configuration and Models

### Task 1.1: Backend Package Setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`

- [ ] **Step 1: Create pyproject.toml**

```toml
[project]
name = "claude-code-viewer-backend"
version = "0.1.0"
description = "Claude Code Viewer Backend"
requires-python = ">=3.10"
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "claude-agent-sdk>=0.1.0",
    "copilotkit>=0.1.0",
    "langchain-openai>=0.1.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "python-dotenv>=1.0.0",
    "anyio>=4.0.0",
    "httpx>=0.25.0",
    "sse-starlette>=1.8.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 2: Create requirements.txt**

```txt
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
claude-agent-sdk>=0.1.0
copilotkit>=0.1.0
langchain-openai>=0.1.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
anyio>=4.0.0
httpx>=0.25.0
sse-starlette>=1.8.0
```

- [ ] **Step 3: Create .env.example**

```bash
# ============ Claude Code SDK 配置 ============
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_AUTH_TOKEN=your_auth_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# Claude Code CLI 路径 (可选)
# CLAUDE_CODE_CLI_PATH=/usr/local/bin/claude

# ============ CopilotKit LLM 配置 ============
COPILOTKIT_LLM_API_KEY=your_api_key_here
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5

# ============ 系统提示词配置 ============
SYSTEM_PROMPT_PATH=./system_prompt.md

# ============ 服务配置 ============
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/requirements.txt backend/.env.example
git commit -m "chore: add backend package configuration"
```

### Task 1.2: Configuration Module

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/config.py`

- [ ] **Step 1: Create __init__.py**

```python
# backend/app/__init__.py
"""Claude Code Viewer Backend Application"""
```

- [ ] **Step 2: Create config.py with system prompt loading**

```python
# backend/app/config.py
from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    """应用配置"""

    # ============ Claude Code SDK 配置 ============
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    # Claude Code CLI
    claude_code_cli_path: Optional[str] = None
    working_directory: str = "."

    # ============ CopilotKit 配置 ============
    copilotkit_llm_api_key: str
    copilotkit_llm_base_url: str
    copilotkit_llm_model: str = "claude-sonnet-4-5"

    # ============ 系统提示词配置 ============
    system_prompt_path: str = "./system_prompt.md"

    # ============ 服务配置 ============
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_system_prompt(self) -> Optional[str]:
        """加载系统提示词"""
        prompt_path = Path(self.system_prompt_path)
        if not prompt_path.exists():
            return None

        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/__init__.py backend/app/config.py
git commit -m "feat: add configuration module with system prompt loading"
```

### Task 1.3: Data Models

**Files:**
- Create: `backend/app/models.py`

- [ ] **Step 1: Create models.py**

```python
# backend/app/models.py
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class ProcessMessageType(str, Enum):
    """思维过程消息类型"""
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    TEXT = "text"
    PERMISSION = "permission"
    RESULT = "result"
    ERROR = "error"


class ProcessMessage(BaseModel):
    """思维过程消息"""
    id: str
    type: ProcessMessageType
    content: str
    timestamp: int

    # 工具相关
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None

    # 权限相关
    risk_level: Optional[str] = None

    # 结果相关
    actions: Optional[List[str]] = None
    cost: Optional[float] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add data models for process messages"
```

### Task 1.4: System Prompt File

**Files:**
- Create: `backend/system_prompt.md`

- [ ] **Step 1: Create system_prompt.md**

```markdown
# Claude Code Viewer 助手

你是一个 Claude Code 助手，帮助用户执行代码任务。

## 工作模式

- 使用 Read 工具先了解项目结构
- 使用 Glob 和 Grep 搜索相关文件
- 使用 Edit 工具修改代码
- 使用 Bash 工具执行命令

## 权限策略

- 读取操作：自动批准
- 编辑操作：需要用户确认
- 执行命令：高风险，需要用户明确确认

## 响应格式

1. 先说明你要做什么
2. 展示关键代码或命令
3. 等待用户确认后执行
4. 执行后汇报结果

## 注意事项

- 不要删除文件，除非用户明确要求
- 执行命令前先解释命令的作用
- 保持代码风格一致
```

- [ ] **Step 2: Commit**

```bash
git add backend/system_prompt.md
git commit -m "feat: add default system prompt template"
```

---

## Chunk 2: Claude SDK Client Wrapper

### Task 2.1: SDK Package Init

**Files:**
- Create: `backend/app/sdk/__init__.py`

- [ ] **Step 1: Create __init__.py**

```python
# backend/app/sdk/__init__.py
"""Claude SDK Client Wrapper"""
from .client import create_claude_client

__all__ = ["create_claude_client"]
```

### Task 2.2: Claude SDK Client

**Files:**
- Create: `backend/app/sdk/client.py`

- [ ] **Step 1: Create client.py**

```python
# backend/app/sdk/client.py
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from app.config import get_settings
from typing import Optional, Callable, Awaitable, Dict, Any


def create_claude_client(
    working_dir: str = None,
    can_use_tool: Optional[Callable[
        [str, Dict[str, Any], Any],
        Awaitable[Any]
    ]] = None,
) -> ClaudeSDKClient:
    """创建配置好的 Claude SDK 客户端

    Args:
        working_dir: 工作目录
        can_use_tool: 权限回调函数

    Returns:
        配置好的 ClaudeSDKClient 实例
    """
    settings = get_settings()

    options = ClaudeAgentOptions(
        # API 配置
        model=settings.anthropic_model,

        # 工作目录
        cwd=working_dir or settings.working_directory,

        # CLI 路径
        cli_path=settings.claude_code_cli_path,

        # 环境变量
        env={
            "ANTHROPIC_API_KEY": settings.anthropic_api_key,
            "ANTHROPIC_AUTH_TOKEN": settings.anthropic_auth_token,
            "ANTHROPIC_BASE_URL": settings.anthropic_base_url,
        },

        # 权限回调
        can_use_tool=can_use_tool,
    )

    return ClaudeSDKClient(options=options)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/sdk/
git commit -m "feat: add Claude SDK client wrapper"
```

---

## Chunk 3: Process Stream API

### Task 3.1: API Package Init

**Files:**
- Create: `backend/app/api/__init__.py`

- [ ] **Step 1: Create __init__.py**

```python
# backend/app/api/__init__.py
"""API Endpoints"""
from .process_stream import router, broadcast_to_subscribers

__all__ = ["router", "broadcast_to_subscribers"]
```

### Task 3.2: Process Stream SSE

**Files:**
- Create: `backend/app/api/process_stream.py`

- [ ] **Step 1: Create process_stream.py**

```python
# backend/app/api/process_stream.py
from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse
import json
import asyncio
from typing import List
from app.models import ProcessMessage

router = APIRouter()

# 存储活跃的订阅者
_subscribers: List[asyncio.Queue] = []


@router.get("/process-stream")
async def process_stream():
    """思维过程 SSE 流"""
    async def event_generator():
        queue = asyncio.Queue()
        _subscribers.append(queue)

        try:
            while True:
                msg = await queue.get()
                yield {
                    "event": "message",
                    "data": json.dumps(msg.model_dump()),
                }
        except asyncio.CancelledError:
            if queue in _subscribers:
                _subscribers.remove(queue)

    return EventSourceResponse(event_generator())


async def broadcast_to_subscribers(msg: ProcessMessage):
    """广播消息到所有订阅者"""
    for queue in _subscribers:
        try:
            await queue.put(msg)
        except Exception:
            pass  # 忽略已关闭的连接
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/
git commit -m "feat: add process stream SSE endpoint"
```

---

## Chunk 4: CopilotKit Agent

### Task 4.1: Agents Package Init

**Files:**
- Create: `backend/app/agents/__init__.py`

- [ ] **Step 1: Create __init__.py**

```python
# backend/app/agents/__init__.py
"""CopilotKit Agents"""
from .claude_code_agent import ClaudeCodeAgent

__all__ = ["ClaudeCodeAgent"]
```

### Task 4.2: Claude Code Agent

**Files:**
- Create: `backend/app/agents/claude_code_agent.py`

- [ ] **Step 1: Create claude_code_agent.py (Part 1 - Imports and Class Definition)**

```python
# backend/app/agents/claude_code_agent.py
from copilotkit import Agent
from app.sdk.client import create_claude_client
from app.models import ProcessMessage, ProcessMessageType
from app.config import get_settings
from app.api.process_stream import broadcast_to_subscribers
import uuid
import time
from typing import Optional, Dict, Any, List


class ClaudeCodeAgent(Agent):
    """CopilotKit Agent 桥接 Claude SDK"""

    def __init__(
        self,
        name: str = "claude_code",
        description: str = "Claude Code 助手",
        llm=None,
        working_dir: Optional[str] = None,
    ):
        super().__init__(name=name, description=description)
        self.llm = llm
        self.working_dir = working_dir or get_settings().working_directory
        self._system_prompt_loaded = False
```

- [ ] **Step 2: Add execute method**

```python
    async def execute(
        self,
        messages: List[Dict],
        thread_id: str,
        state: Dict,
        **kwargs
    ):
        """执行 Agent - 由 CopilotKit 调用"""
        user_message = messages[-1]["content"]
        settings = get_settings()

        # 创建客户端
        client = create_claude_client(
            working_dir=self.working_dir,
            can_use_tool=self._handle_permission,
        )

        async with client:
            # 首次对话时，加载系统提示词
            if not self._system_prompt_loaded:
                system_prompt = settings.get_system_prompt()
                if system_prompt:
                    await client.query(system_prompt, session_id=thread_id)
                    self._system_prompt_loaded = True

            # 发送用户消息
            await client.query(user_message, session_id=thread_id)

            # 接收响应流
            async for msg in client.receive_messages():
                # 广播思维过程
                process_msg = self._convert_to_process_message(msg)
                if process_msg:
                    await broadcast_to_subscribers(process_msg)

                # 如果是最终结果，返回给 CopilotKit
                if hasattr(msg, 'result') and msg.result:
                    yield {
                        "content": msg.result,
                        "metadata": {
                            "cost": getattr(msg, 'total_cost_usd', None),
                            "duration_ms": getattr(msg, 'duration_ms', None),
                        }
                    }
```

- [ ] **Step 3: Add permission handler**

```python
    async def _handle_permission(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        context: Any
    ):
        """处理权限请求"""
        request_id = str(uuid.uuid4())

        # 广播权限请求到前端
        permission_msg = ProcessMessage(
            id=request_id,
            type=ProcessMessageType.PERMISSION,
            content=f"请求执行工具: {tool_name}",
            timestamp=int(time.time() * 1000),
            tool_name=tool_name,
            tool_input=tool_input,
            risk_level=self._get_risk_level(tool_name),
        )
        await broadcast_to_subscribers(permission_msg)

        # TODO: 等待前端通过 CopilotKit Action 响应
        # 目前默认批准低风险操作
        from claude_agent_sdk import PermissionResultAllow, PermissionResultDeny

        if self._get_risk_level(tool_name) == "low":
            return PermissionResultAllow()
        else:
            # 中高风险需要用户确认，暂时拒绝
            return PermissionResultDeny(message="需要用户确认")
```

- [ ] **Step 4: Add helper methods**

```python
    def _get_risk_level(self, tool_name: str) -> str:
        """根据工具名判断风险等级"""
        HIGH_RISK = {"Bash", "Write", "Edit", "delete_file"}
        MEDIUM_RISK = {"git", "npm", "pip"}

        if tool_name in HIGH_RISK:
            return "high"
        elif tool_name in MEDIUM_RISK:
            return "medium"
        return "low"

    def _convert_to_process_message(self, msg) -> Optional[ProcessMessage]:
        """将 Claude SDK 消息转换为 ProcessMessage"""
        msg_id = str(uuid.uuid4())
        timestamp = int(time.time() * 1000)

        # 检查消息类型并转换
        msg_type = type(msg).__name__

        if msg_type == "AssistantMessage":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TEXT,
                content=str(msg.content)[:500] if msg.content else "",
                timestamp=timestamp,
            )

        elif msg_type == "ToolUseBlock":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TOOL_USE,
                content=f"调用工具: {getattr(msg, 'name', 'unknown')}",
                timestamp=timestamp,
                tool_name=getattr(msg, 'name', None),
                tool_input=getattr(msg, 'input', None),
            )

        elif msg_type == "ToolResultBlock":
            content = getattr(msg, 'content', '')
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TOOL_RESULT,
                content=str(content)[:500] if content else "",
                timestamp=timestamp,
                tool_result=content,
            )

        elif msg_type == "ResultMessage":
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.RESULT,
                content=getattr(msg, 'result', '任务完成') or "任务完成",
                timestamp=timestamp,
                cost=getattr(msg, 'total_cost_usd', None),
            )

        return None
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/agents/
git commit -m "feat: add Claude Code Agent with CopilotKit integration"
```

---

## Chunk 5: FastAPI Main Application

### Task 5.1: Main Application Entry

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: Create main.py**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from copilotkit.integrations.fastapi import add_fastapi_endpoint
from app.config import get_settings
from app.agents.claude_code_agent import ClaudeCodeAgent
from app.api import process_stream

settings = get_settings()

app = FastAPI(
    title="Claude Code Viewer",
    description="可视化 Claude Code 执行过程",
    version="0.1.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(process_stream.router, prefix="/api", tags=["stream"])


def create_copilotkit_endpoint():
    """创建 CopilotKit Endpoint"""
    from copilotkit import CopilotKitRemoteEndpoint
    from langchain_openai import ChatOpenAI

    settings = get_settings()

    llm = ChatOpenAI(
        api_key=settings.copilotkit_llm_api_key,
        base_url=settings.copilotkit_llm_base_url,
        model=settings.copilotkit_llm_model,
    )

    return CopilotKitRemoteEndpoint(
        agents=[
            ClaudeCodeAgent(
                name="claude_code",
                description="Claude Code 助手 - 执行代码任务",
                llm=llm,
            )
        ],
    )


# 注册 CopilotKit Endpoint
sdk = create_copilotkit_endpoint()
add_fastapi_endpoint(app, sdk, "/copilotkit")


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Claude Code Viewer API",
        "version": "0.1.0",
        "docs": "/docs",
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI main application with CopilotKit integration"
```

### Task 5.2: Create .env file from example

**Files:**
- Create: `backend/.env`

- [ ] **Step 1: Copy .env.example to .env**

```bash
cp backend/.env.example backend/.env
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env
git commit -m "chore: add .env file from template"
```

---

## Chunk 6: Frontend Package Setup

### Task 6.1: Frontend Package Configuration

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "claude-code-viewer-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@copilotkit/react-core": "^1.0.0",
    "@copilotkit/react-ui": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/copilotkit': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 5: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 6: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 7: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude Code Viewer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create .env.example**

```bash
# CopilotKit 配置
VITE_COPILOTKIT_PUBLIC_API_KEY=your_public_key
VITE_COPILOTKIT_AGENT=claude_code

# 后端 API 地址
VITE_API_URL=http://localhost:8000
```

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: add frontend package configuration"
```

---

## Chunk 7: Frontend Types and Hooks

### Task 7.1: Type Definitions

**Files:**
- Create: `frontend/src/types/messages.ts`

- [ ] **Step 1: Create messages.ts**

```typescript
// frontend/src/types/messages.ts

export type ProcessMessageType =
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "text"
  | "permission"
  | "result"
  | "error";

export interface ProcessMessage {
  id: string;
  type: ProcessMessageType;
  content: string;
  timestamp: number;

  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_result?: unknown;

  risk_level?: "low" | "medium" | "high";

  actions?: string[];
  cost?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/
git commit -m "feat: add frontend type definitions"
```

### Task 7.2: Process Stream Hook

**Files:**
- Create: `frontend/src/hooks/useProcessStream.ts`

- [ ] **Step 1: Create useProcessStream.ts**

```typescript
// frontend/src/hooks/useProcessStream.ts
import { useEffect, useState, useCallback } from "react";
import type { ProcessMessage } from "../types/messages";

export function useProcessStream() {
  const [messages, setMessages] = useState<ProcessMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
    const eventSource = new EventSource(`${apiUrl}/api/process-stream`);

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("Process stream connected");
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      console.error("Process stream error");
    };

    eventSource.onmessage = (event) => {
      try {
        const msg: ProcessMessage = JSON.parse(event.data);
        setMessages((prev) => [...prev, msg]);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, clearMessages };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add useProcessStream hook"
```

---

## Chunk 8: Frontend Layout Components

### Task 8.1: Main Entry Files

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Create main.tsx**

```tsx
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 2: Create index.css**

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
}

#root {
  width: 100%;
  height: 100vh;
}
```

- [ ] **Step 3: Create App.tsx**

```tsx
// frontend/src/App.tsx
import { CopilotKit } from "@copilotkit/react";
import "@copilotkit/react-ui/styles.css";
import { PhoneFrame } from "./components/layout/PhoneFrame";
import { ProcessPanel } from "./components/process/ProcessPanel";
import { CopilotChat } from "./components/chat/CopilotChat";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  return (
    <CopilotKit
      agent="claude_code"
      runtimeUrl={`${apiUrl}/copilotkit`}
    >
      <div className="flex h-screen bg-gray-100">
        {/* 左侧：手机框架内的 CopilotKit UI */}
        <div className="w-1/2 flex items-center justify-center p-4">
          <PhoneFrame>
            <CopilotChat />
          </PhoneFrame>
        </div>

        {/* 右侧：思维过程面板 */}
        <div className="w-1/2 border-l border-gray-200">
          <ProcessPanel />
        </div>
      </div>
    </CopilotKit>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css
git commit -m "feat: add main entry files"
```

### Task 8.2: Phone Frame Component

**Files:**
- Create: `frontend/src/components/layout/PhoneFrame.tsx`

- [ ] **Step 1: Create PhoneFrame.tsx**

```tsx
// frontend/src/components/layout/PhoneFrame.tsx
import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative">
      {/* 手机外壳 */}
      <div className="w-[375px] h-[812px] bg-gray-900 rounded-[50px] p-3 shadow-2xl">
        {/* 屏幕 */}
        <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative">
          {/* 刘海 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10" />

          {/* 内容区域 */}
          <div className="h-full pt-8 overflow-hidden">
            {children}
          </div>

          {/* 底部指示条 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/layout/PhoneFrame.tsx
git commit -m "feat: add PhoneFrame component"
```

---

## Chunk 9: Frontend Chat Components

### Task 9.1: Copilot Chat Component

**Files:**
- Create: `frontend/src/components/chat/CopilotChat.tsx`

- [ ] **Step 1: Create CopilotChat.tsx**

```tsx
// frontend/src/components/chat/CopilotChat.tsx
import { CopilotPopup } from "@copilotkit/react-ui";
import { PermissionCard } from "../interaction/PermissionCard";
import { SelectionCard } from "../interaction/SelectionCard";

export function CopilotChat() {
  return (
    <div className="h-full flex flex-col">
      {/* 交互组件区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PermissionCard />
        <SelectionCard />
      </div>

      {/* CopilotKit 聊天弹窗 */}
      <CopilotPopup
        instructions="你是一个 Claude Code 助手，帮助用户执行代码任务。"
        labels={{
          title: "Claude Code",
          initial: "有什么我可以帮你的？",
          placeholder: "输入你的问题...",
        }}
        defaultOpen={true}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/chat/CopilotChat.tsx
git commit -m "feat: add CopilotChat component"
```

---

## Chunk 10: Frontend Interaction Components

### Task 10.1: Permission Card Component

**Files:**
- Create: `frontend/src/components/interaction/PermissionCard.tsx`

- [ ] **Step 1: Create PermissionCard.tsx**

```tsx
// frontend/src/components/interaction/PermissionCard.tsx
import { useCopilotAction } from "@copilotkit/react-core";
import { useState } from "react";

interface PermissionRequest {
  requestId: string;
  toolName: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

export function PermissionCard() {
  const [request, setRequest] = useState<PermissionRequest | null>(null);

  useCopilotAction({
    name: "request_permission",
    description: "请求用户权限确认",
    parameters: [
      { name: "requestId", type: "string" },
      { name: "toolName", type: "string" },
      { name: "description", type: "string" },
      { name: "riskLevel", type: "string" },
    ],
    renderAndWaitForResponse: ({ args, respond }) => {
      setRequest({
        requestId: args.requestId,
        toolName: args.toolName,
        description: args.description,
        riskLevel: args.riskLevel as "low" | "medium" | "high",
      });

      return new Promise((resolve) => {
        (window as any)._permissionResolver = (approved: boolean) => {
          respond?.({ approved });
          setRequest(null);
          resolve(null);
        };
      });
    },
  });

  if (!request) return null;

  const riskColors = {
    low: "bg-green-50 border-green-200",
    medium: "bg-yellow-50 border-yellow-200",
    high: "bg-red-50 border-red-200",
  };

  const riskLabels = {
    low: "🟢 低风险",
    medium: "🟡 中风险",
    high: "🔴 高风险",
  };

  return (
    <div className={`rounded-lg border p-4 ${riskColors[request.riskLevel]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">{riskLabels[request.riskLevel]}</span>
        <span className="text-xs text-gray-500">权限请求</span>
      </div>

      <h3 className="font-semibold mb-2">执行工具: {request.toolName}</h3>
      <p className="text-sm text-gray-600 mb-4">{request.description}</p>

      <div className="flex gap-2">
        <button
          onClick={() => (window as any)._permissionResolver?.(true)}
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
        >
          ✅ 允许
        </button>
        <button
          onClick={() => (window as any)._permissionResolver?.(false)}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
        >
          ❌ 拒绝
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/interaction/PermissionCard.tsx
git commit -m "feat: add PermissionCard component"
```

### Task 10.2: Selection Card Component

**Files:**
- Create: `frontend/src/components/interaction/SelectionCard.tsx`

- [ ] **Step 1: Create SelectionCard.tsx**

```tsx
// frontend/src/components/interaction/SelectionCard.tsx
import { useCopilotAction } from "@copilotkit/react-core";
import { useState } from "react";

interface SelectionRequest {
  requestId: string;
  title: string;
  options: string[];
  multiSelect: boolean;
}

export function SelectionCard() {
  const [request, setRequest] = useState<SelectionRequest | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useCopilotAction({
    name: "request_selection",
    description: "请求用户选择选项",
    parameters: [
      { name: "requestId", type: "string" },
      { name: "title", type: "string" },
      { name: "options", type: "array" },
      { name: "multiSelect", type: "boolean" },
    ],
    renderAndWaitForResponse: ({ args, respond }) => {
      setRequest({
        requestId: args.requestId,
        title: args.title,
        options: args.options,
        multiSelect: args.multiSelect,
      });
      setSelected([]);

      return new Promise((resolve) => {
        (window as any)._selectionResolver = (values: string[]) => {
          respond?.({ selected: values });
          setRequest(null);
          resolve(null);
        };
      });
    },
  });

  if (!request) return null;

  const toggleOption = (option: string) => {
    if (request.multiSelect) {
      setSelected((prev) =>
        prev.includes(option)
          ? prev.filter((o) => o !== option)
          : [...prev, option]
      );
    } else {
      setSelected([option]);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h3 className="font-semibold mb-3">{request.title}</h3>

      <div className="space-y-2 mb-4">
        {request.options.map((option) => (
          <label
            key={option}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selected.includes(option)
                ? "bg-blue-50 border-blue-300"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <input
              type={request.multiSelect ? "checkbox" : "radio"}
              checked={selected.includes(option)}
              onChange={() => toggleOption(option)}
              className="w-4 h-4"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>

      <button
        onClick={() => (window as any)._selectionResolver?.(selected)}
        disabled={selected.length === 0}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        确认选择
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/interaction/SelectionCard.tsx
git commit -m "feat: add SelectionCard component"
```

### Task 10.3: Summary Card Component

**Files:**
- Create: `frontend/src/components/interaction/SummaryCard.tsx`

- [ ] **Step 1: Create SummaryCard.tsx**

```tsx
// frontend/src/components/interaction/SummaryCard.tsx
interface SummaryData {
  title: string;
  content: string;
  actions?: string[];
  cost?: number;
}

interface SummaryCardProps {
  data: SummaryData;
}

export function SummaryCard({ data }: SummaryCardProps) {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">✨</span>
        <h3 className="font-semibold text-blue-900">{data.title}</h3>
      </div>

      <p className="text-sm text-gray-700 mb-3">{data.content}</p>

      {data.actions && data.actions.length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-medium text-gray-500 mb-2">执行的操作:</h4>
          <ul className="space-y-1">
            {data.actions.map((action, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.cost !== undefined && (
        <div className="text-xs text-gray-400 flex justify-end">
          费用: ${data.cost.toFixed(4)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/interaction/SummaryCard.tsx
git commit -m "feat: add SummaryCard component"
```

---

## Chunk 11: Frontend Process Panel Components

### Task 11.1: Process Panel Component

**Files:**
- Create: `frontend/src/components/process/ProcessPanel.tsx`

- [ ] **Step 1: Create ProcessPanel.tsx**

```tsx
// frontend/src/components/process/ProcessPanel.tsx
import { useProcessStream } from "../../hooks/useProcessStream";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolUseBlock } from "./ToolUseBlock";
import { ToolResultBlock } from "./ToolResultBlock";
import { SummaryCard } from "../interaction/SummaryCard";

export function ProcessPanel() {
  const { messages, isConnected, clearMessages } = useProcessStream();

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">思维过程</h2>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <button
          onClick={clearMessages}
          className="text-xs text-gray-400 hover:text-white"
        >
          清空
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            等待 Claude 思考...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {(msg.type === "text" || msg.type === "thinking") && (
              <ThinkingBlock content={msg.content} />
            )}
            {msg.type === "tool_use" && (
              <ToolUseBlock toolName={msg.tool_name} input={msg.tool_input} />
            )}
            {msg.type === "tool_result" && (
              <ToolResultBlock result={msg.tool_result} />
            )}
            {msg.type === "result" && (
              <SummaryCard
                data={{
                  title: "任务完成",
                  content: msg.content,
                  actions: msg.actions,
                  cost: msg.cost,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/process/ProcessPanel.tsx
git commit -m "feat: add ProcessPanel component"
```

### Task 11.2: Thinking Block Component

**Files:**
- Create: `frontend/src/components/process/ThinkingBlock.tsx`

- [ ] **Step 1: Create ThinkingBlock.tsx**

```tsx
// frontend/src/components/process/ThinkingBlock.tsx
interface ThinkingBlockProps {
  content: string;
}

export function ThinkingBlock({ content }: ThinkingBlockProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-2 text-gray-400">
        <span>💭</span>
        <span className="text-xs">思考</span>
      </div>
      <p className="text-gray-200 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/process/ThinkingBlock.tsx
git commit -m "feat: add ThinkingBlock component"
```

### Task 11.3: Tool Use Block Component

**Files:**
- Create: `frontend/src/components/process/ToolUseBlock.tsx`

- [ ] **Step 1: Create ToolUseBlock.tsx**

```tsx
// frontend/src/components/process/ToolUseBlock.tsx
interface ToolUseBlockProps {
  toolName?: string;
  input?: Record<string, unknown>;
}

export function ToolUseBlock({ toolName, input }: ToolUseBlockProps) {
  return (
    <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-2 text-blue-400">
        <span>⚙️</span>
        <span className="text-xs">工具调用</span>
      </div>
      <p className="text-blue-200 font-medium mb-2">{toolName || "未知工具"}</p>
      {input && (
        <pre className="text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto">
          {JSON.stringify(input, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/process/ToolUseBlock.tsx
git commit -m "feat: add ToolUseBlock component"
```

### Task 11.4: Tool Result Block Component

**Files:**
- Create: `frontend/src/components/process/ToolResultBlock.tsx`

- [ ] **Step 1: Create ToolResultBlock.tsx**

```tsx
// frontend/src/components/process/ToolResultBlock.tsx
interface ToolResultBlockProps {
  result?: unknown;
}

export function ToolResultBlock({ result }: ToolResultBlockProps) {
  const content = typeof result === "string"
    ? result
    : JSON.stringify(result, null, 2);

  return (
    <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-2 text-green-400">
        <span>✓</span>
        <span className="text-xs">工具结果</span>
      </div>
      <pre className="text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto max-h-40">
        {content}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/process/ToolResultBlock.tsx
git commit -m "feat: add ToolResultBlock component"
```

---

## Chunk 12: Final Setup and Testing

### Task 12.1: Create .env file for frontend

**Files:**
- Create: `frontend/.env`

- [ ] **Step 1: Copy .env.example to .env**

```bash
cp frontend/.env.example frontend/.env
```

- [ ] **Step 2: Commit**

```bash
git add frontend/.env
git commit -m "chore: add frontend .env file"
```

### Task 12.2: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md**

```markdown
# Claude Code Viewer

一个用于可视化 Claude Code 执行过程的 Web 应用，集成 CopilotKit 提供美化的交互界面。

## 功能特点

- 🖥️ **左侧手机框架**: 显示 CopilotKit 美化的交互界面
- 📋 **右侧思维面板**: 显示 Claude Code 完整思维过程
- 🔄 **双向交互**: 用户通过 CopilotKit 界面回复权限请求
- 📝 **系统提示词**: 首次对话前自动加载可配置的系统提示词
- 🎨 **丰富 UI**: 权限卡片、下拉选择器、进度指示器、结果摘要

## 技术栈

### 前端
- React 18
- Vite
- Tailwind CSS
- CopilotKit (React)

### 后端
- Python FastAPI
- Claude Agent SDK (claude-agent-sdk-python)
- CopilotKit SDK (copilotkit)
- SSE (Server-Sent Events)

## 快速开始

### 后端

\`\`\`bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 密钥
uvicorn app.main:app --reload --port 8000
\`\`\`

### 前端

\`\`\`bash
cd frontend
npm install
cp .env.example .env
# 编辑 .env 配置
npm run dev
\`\`\`

## 配置

### 环境变量

后端:
\`\`\`
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_AUTH_TOKEN=your_auth_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5
COPILOTKIT_LLM_API_KEY=your_api_key
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5
SYSTEM_PROMPT_PATH=./system_prompt.md
\`\`\`

前端:
\`\`\`
VITE_API_URL=http://localhost:8000
\`\`\`

## 文档

详细设计文档请参阅 [docs/index.md](docs/index.md)

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with new architecture"
```

### Task 12.3: Final verification

- [ ] **Step 1: Verify backend can start**

```bash
cd backend
source venv/bin/activate 2>/dev/null || python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
sleep 3
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

- [ ] **Step 2: Verify frontend can start**

```bash
cd frontend
npm install
npm run dev &
sleep 5
curl http://localhost:5173 | head -20
# Expected: HTML content with title "Claude Code Viewer"
```

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Claude Code Viewer redesign"
```

---

## Summary

This plan creates a complete Claude Code Viewer application with:

1. **Backend (FastAPI + Python)**
   - Configuration management with system prompt loading
   - Claude SDK client wrapper
   - CopilotKit Agent integration
   - SSE process stream endpoint

2. **Frontend (React + Vite)**
   - CopilotKit chat interface in phone frame
   - Process panel showing thinking steps
   - Interactive permission and selection cards

3. **Integration**
   - First conversation loads system prompt
   - Real-time thinking process broadcast via SSE
   - User interactions through CopilotKit Actions

**Total Tasks:** 12 chunks, ~40 steps
