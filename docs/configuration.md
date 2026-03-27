# 配置管理

## 环境变量

### 后端配置 (.env)

```bash
# ============ Claude Code SDK 配置 ============
ANTHROPIC_API_KEY=sk-6a122b8d43461efcc0e8f248c97b10e2
ANTHROPIC_AUTH_TOKEN=sk-6a122b8d43461efcc0e8f248c97b10e2
ANTHROPIC_BASE_URL=https://aiclaude.frp.strongsickcat.com
ANTHROPIC_MODEL=glm-5

# Claude Code CLI 路径 (可选，默认使用 SDK 内置)
# CLAUDE_CODE_CLI_PATH=/usr/local/bin/claude

# ============ CopilotKit LLM 配置 ============
COPILOTKIT_LLM_API_KEY=sk-6a122b8d43461efcc0e8f248c97b10e2
COPILOTKIT_LLM_BASE_URL=https://aiclaude.frp.strongsickcat.com
COPILOTKIT_LLM_MODEL=glm-5

# ============ 系统提示词配置 ============
# 系统提示词文件路径 (首次对话前加载)
SYSTEM_PROMPT_PATH=./system_prompt.md

# ============ 服务配置 ============
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

### 前端配置 (.env)

```bash
# CopilotKit 配置
VITE_COPILOTKIT_PUBLIC_API_KEY=your_public_key
VITE_COPILOTKIT_AGENT=claude_code

# 后端 API 地址
VITE_API_URL=http://localhost:8000
```

## 系统提示词配置

### 配置说明

在用户首次与 Claude Code 对话时，系统会预先加载一个系统提示词，用于：
- 设定 Claude Code 的行为模式
- 提供项目上下文
- 定义工作流程
- 配置权限策略

### 提示词文件 (system_prompt.md)

```markdown
# backend/system_prompt.md

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

### 配置模块 (backend/app/config.py)

```python
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

### 使用系统提示词

```python
# backend/app/sdk/client.py

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from app.config import get_settings
from typing import Optional, Callable, Awaitable

def create_claude_client(
    working_dir: str = None,
    can_use_tool: Optional[Callable] = None,
) -> ClaudeSDKClient:
    """创建配置好的 Claude SDK 客户端"""
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

        # 系统提示词 (首次对话前加载)
        system_prompt=settings.get_system_prompt(),

        # 权限回调
        can_use_tool=can_use_tool,
    )

    return ClaudeSDKClient(options=options)
```

### Agent 中加载提示词

```python
# backend/app/agents/claude_code_agent.py

class ClaudeCodeAgent(Agent):
    """CopilotKit Agent 桥接 Claude SDK"""

    def __init__(self, working_dir=None):
        self.working_dir = working_dir or get_settings().working_directory
        self._system_prompt_loaded = False

    async def execute(self, messages, thread_id, state, **kwargs):
        user_message = messages[-1]["content"]

        # 首次对话时，加载系统提示词
        if not self._system_prompt_loaded:
            system_prompt = get_settings().get_system_prompt()
            if system_prompt:
                # 作为第一条消息发送给 Claude
                await self._send_system_prompt(system_prompt, thread_id)
                self._system_prompt_loaded = True

        # 然后转发用户消息
        client = create_claude_client(
            working_dir=self.working_dir,
            can_use_tool=self._handle_permission,
        )

        async with client:
            await client.query(user_message, session_id=thread_id)
            # ... 后续处理
```

## 配置说明

| 配置项 | 用途 | 备注 |
|--------|------|------|
| `ANTHROPIC_*` | Claude Code SDK 连接 | 用于与 Claude Code CLI 通信 |
| `COPILOTKIT_LLM_*` | CopilotKit Agent | CopilotKit 内部 AI 功能使用 |
| `SYSTEM_PROMPT_PATH` | 系统提示词文件路径 | 首次对话前加载 |

**注意**: Claude Code SDK 和 CopilotKit 可以配置相同的模型地址（如 GLM-5 代理），也可以分别配置不同的模型。

## 默认系统提示词模板

如果未配置 `SYSTEM_PROMPT_PATH` 或文件不存在，使用默认提示词：

```python
DEFAULT_SYSTEM_PROMPT = """
你是 Claude Code，一个强大的代码助手。

## 能力
- 读取和分析代码
- 编写和修改代码
- 执行命令和脚本
- 搜索和查找文件

## 工作流程
1. 理解用户需求
2. 分析相关代码
3. 提出解决方案
4. 等待确认后执行
5. 验证并汇报结果

## 权限处理
- 只读操作自动执行
- 写入操作需要确认
- 危险操作需要明确批准
"""
```

## Docker Compose 配置

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ANTHROPIC_AUTH_TOKEN=${ANTHROPIC_AUTH_TOKEN}
      - ANTHROPIC_BASE_URL=${ANTHROPIC_BASE_URL}
      - ANTHROPIC_MODEL=${ANTHROPIC_MODEL}
      - COPILOTKIT_LLM_API_KEY=${COPILOTKIT_LLM_API_KEY}
      - COPILOTKIT_LLM_BASE_URL=${COPILOTKIT_LLM_BASE_URL}
      - COPILOTKIT_LLM_MODEL=${COPILOTKIT_LLM_MODEL}
    volumes:
      - ./workspace:/app/workspace
      - ./system_prompt.md:/app/system_prompt.md

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://backend:8000
    depends_on:
      - backend
```
