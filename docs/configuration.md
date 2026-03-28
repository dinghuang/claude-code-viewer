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

# 工作目录 (Claude Code 执行的根目录)
WORKING_DIRECTORY=/path/to/your/project

# ============ MCP 服务器配置 (JSON 字符串) ============
CLAUDE_CODE_MCP_SERVERS={"webresearch":{...},"qieman":{...},...}

# ============ CopilotKit LLM 配置 (可选) ============
COPILOTKIT_LLM_API_KEY=your_api_key_here
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5

# ============ 文件路径配置 ============
SYSTEM_PROMPT_PATH=./system_prompt.md
USER_INFO_PATH=./user_info.md

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
# Python 后端 API 地址 (用于 SSE 流和 REST API)
VITE_API_URL=http://localhost:8000

# CopilotKit Runtime 地址 (用于 CopilotKit 通信)
VITE_COPILOTKIT_RUNTIME_URL=http://localhost:4000
```

## 配置关系图

```
frontend/.env                      runtime (env vars)           backend/.env
┌──────────────────────┐           ┌──────────────────┐         ┌──────────────────┐
│ VITE_API_URL         │──────────────────────────────────────> │ Port 8000         │
│ = localhost:8000     │ (SSE+REST)│                  │         │                   │
│                      │           │ AGENT_URL        │────────>│ POST / (AG-UI)    │
│ VITE_COPILOTKIT_     │           │ = localhost:8000 │         │                   │
│ RUNTIME_URL          │──────────>│                  │         │ ANTHROPIC_*       │
│ = localhost:4000     │           │ RUNTIME_PORT     │         │ SYSTEM_PROMPT_*   │
│                      │           │ = 4000           │         │ USER_INFO_PATH    │
└──────────────────────┘           └──────────────────┘         └──────────────────┘
```

## 用户信息与系统提示词配置

### 文件存储

| 文件 | 路径 | 说明 |
|------|------|------|
| 用户画像 | `backend/user_info.md` | 客户基本信息、资产状况、投资偏好 |
| 系统提示词 | `backend/system_prompt.md` | AI 投顾角色定义、投资研究技能、工具使用规则 |

### 加载优先级

```
前端 POST 覆盖 (内存中) > 文件 fallback (system_prompt.md)
```

### 数据流

**页面加载时：**
1. 前端 `GET /api/user-info` → 后端实时读取 `user_info.md`（无缓存）
2. 前端 `GET /api/system-prompt` → 后端实时读取 `system_prompt.md`（无缓存）
3. 前端拼接 `用户信息 + "---" + 系统提示词` → `POST /api/system-prompt`
4. 后端存入内存，下次 Agent 执行时使用

**用户编辑保存：**
1. 前端设置面板拼接两个 textarea 内容
2. `POST /api/system-prompt` 更新后端内存
3. 前端仅做 state 缓存，不修改后端文件
4. 刷新页面 → 重新从文件 API 读取 → 恢复为文件内容

### 配置模块 (backend/app/config.py)

```python
class Settings(BaseSettings):
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    system_prompt_path: str = "./system_prompt.md"
    user_info_path: str = "./user_info.md"

    class Config:
        env_file = ".env"

    def get_system_prompt(self) -> Optional[str]:
        """直接读文件，无缓存"""
        prompt_path = Path(self.system_prompt_path)
        if not prompt_path.exists():
            return None
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()

    def get_user_info(self) -> Optional[str]:
        """直接读文件，无缓存"""
        info_path = Path(self.user_info_path)
        if not info_path.exists():
            return None
        with open(info_path, "r", encoding="utf-8") as f:
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

```bash
pyenv install 3.12
cd backend
pyenv local 3.12
python -m venv venv
```
