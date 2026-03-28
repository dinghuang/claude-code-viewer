# 配置管理

## 环境变量

本项目有三个服务，各自的配置如下：

### 后端配置 (backend/.env)

```bash
# ============ Claude Code SDK 配置 (必填) ============
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_AUTH_TOKEN=your_auth_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# Claude Code CLI 路径 (可选，默认使用系统 PATH 中的 claude)
# CLAUDE_CODE_CLI_PATH=/usr/local/bin/claude

# ============ CopilotKit LLM 配置 (可选) ============
# 如果不配置，CopilotKit 将使用默认设置
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

### Runtime 配置 (环境变量)

Runtime 通过环境变量配置，无 `.env` 文件：

```bash
# Python 后端 AG-UI 端点地址
AGENT_URL=http://localhost:8000

# Runtime 监听端口
RUNTIME_PORT=4000
```

### 前端配置 (frontend/.env)

```bash
# Python 后端 API 地址 (用于 SSE 流和 Vite proxy)
VITE_API_URL=http://localhost:8000

# CopilotKit Runtime 地址 (用于 CopilotKit 通信)
VITE_COPILOTKIT_RUNTIME_URL=http://localhost:4000
```

## 配置关系图

```
frontend/.env                      runtime (env vars)           backend/.env
┌──────────────────────┐           ┌──────────────────┐         ┌──────────────────┐
│ VITE_API_URL         │──────────────────────────────────────> │ Port 8000         │
│ = localhost:8000     │ (SSE 流)  │                  │         │                   │
│                      │           │ AGENT_URL        │────────>│ POST / (AG-UI)    │
│ VITE_COPILOTKIT_     │           │ = localhost:8000 │         │                   │
│ RUNTIME_URL          │──────────>│                  │         │ ANTHROPIC_*       │
│ = localhost:4000     │           │ RUNTIME_PORT     │         │ SYSTEM_PROMPT_*   │
│                      │           │ = 4000           │         │                   │
└──────────────────────┘           └──────────────────┘         └──────────────────┘
```

## 系统提示词配置

### 优先级

系统提示词有两个来源，按优先级排序：

1. **前端编辑器** (最高优先级) — 左下角齿轮浮窗编辑后通过 `POST /api/system-prompt` 同步到后端内存
2. **文件 fallback** — `backend/system_prompt.md`，仅当前端未设置时使用

### 前端编辑器

页面左下角齿轮按钮打开系统提示词编辑浮窗，编辑后保存会调用：

```bash
# 更新提示词
POST http://localhost:8000/api/system-prompt
Content-Type: application/json
{"prompt": "你的自定义提示词..."}

# 查询当前提示词
GET http://localhost:8000/api/system-prompt
→ {"prompt": "当前生效的提示词..."}
```

### 默认提示词 (内置在前端 + 文件 fallback)

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
```

### 配置模块 (backend/app/config.py)

```python
from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    system_prompt_path: str = "./system_prompt.md"

    class Config:
        env_file = ".env"

    def get_system_prompt(self) -> Optional[str]:
        prompt_path = Path(self.system_prompt_path)
        if not prompt_path.exists():
            return None
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()
```

## 端口分配

| 服务 | 默认端口 | 配置方式 |
|------|----------|----------|
| Python 后端 | 8000 | `uvicorn --port 8000` |
| CopilotKit Runtime | 4000 | `RUNTIME_PORT=4000` |
| Vite 前端 | 3000 | `vite.config.ts` 中 `server.port` |

## Python 版本要求

CopilotKit Python SDK (copilotkit >= 0.1.40) 要求 Python >= 3.10, < 3.13。

推荐使用 pyenv 管理 Python 版本：

```bash
pyenv install 3.12
cd backend
pyenv local 3.12
python -m venv venv
```
