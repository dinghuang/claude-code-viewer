# 后端设计

## 模块结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口 + CopilotKit 集成
│   ├── config.py               # 配置管理
│   ├── models.py               # 数据模型
│   │
│   ├── agents/                 # CopilotKit Agents
│   │   ├── __init__.py
│   │   └── claude_code_agent.py   # Claude Code Agent
│   │
│   ├── sdk/                    # Claude SDK 封装
│   │   ├── __init__.py
│   │   └── client.py           # Claude SDK 客户端
│   │
│   ├── actions/                # CopilotKit Actions
│   │   ├── __init__.py
│   │   ├── permission_action.py   # 权限确认
│   │   └── selection_action.py    # 选择器
│   │
│   └── api/                    # API 端点
│       ├── __init__.py
│       └── process_stream.py   # 思维过程流
│
├── system_prompt.md            # 系统提示词配置
├── requirements.txt
├── pyproject.toml
├── .env.example
└── .env
```

## 核心模块

### 1. FastAPI 入口 (main.py)

```python
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

# CopilotKit 集成
def create_copilotkit_endpoint():
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
        actions=[
            # Actions 在 Agent 内部注册
        ],
    )

sdk = create_copilotkit_endpoint()
add_fastapi_endpoint(app, sdk, "/copilotkit")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### 2. Claude Code Agent (agents/claude_code_agent.py)

```python
from copilotkit import Agent
from claude_agent_sdk import (
    ClaudeSDKClient,
    AssistantMessage,
    ToolUseBlock,
    ToolResultBlock,
    ResultMessage,
    PermissionResultAllow,
    PermissionResultDeny,
)
from app.sdk.client import create_claude_client
from app.models import ProcessMessage, ProcessMessageType
from app.config import get_settings
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
        self._stream_subscribers: List = []
        self._system_prompt_loaded = False  # 追踪系统提示词是否已加载

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
            # 首次对话时，先发送系统提示词
            if not self._system_prompt_loaded:
                system_prompt = settings.get_system_prompt()
                if system_prompt:
                    # 作为第一条消息发送给 Claude
                    await client.query(system_prompt, session_id=thread_id)
                    # 等待 Claude 确认
                    async for msg in client.receive_messages():
                        if isinstance(msg, ResultMessage):
                            break
                    self._system_prompt_loaded = True

            # 然后发送用户消息
            await client.query(user_message, session_id=thread_id)

            async for msg in client.receive_messages():
                # 广播思维过程
                process_msg = self._convert_to_process_message(msg)
                if process_msg:
                    await self._broadcast(process_msg)

                # 如果是最终结果，返回给 CopilotKit
                if isinstance(msg, ResultMessage):
                    yield {
                        "content": msg.result or "任务完成",
                        "metadata": {
                            "cost": msg.total_cost_usd,
                            "duration_ms": msg.duration_ms,
                        }
                    }

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
        await self._broadcast(permission_msg)

        # 等待前端响应 (通过 CopilotKit Action)
        approved = await self._wait_for_permission_response(request_id)

        if approved:
            return PermissionResultAllow()
        else:
            return PermissionResultDeny(message="用户拒绝执行")

    async def _wait_for_permission_response(self, request_id: str) -> bool:
        """等待前端权限响应"""
        # 通过 CopilotKit Action 机制等待
        # 实现细节取决于 CopilotKit 的 API
        pass

    async def _broadcast(self, msg: ProcessMessage):
        """广播思维过程到所有订阅者"""
        for subscriber in self._stream_subscribers:
            await subscriber(msg)

    def subscribe(self, callback):
        """订阅思维过程流"""
        self._stream_subscribers.append(callback)
        return lambda: self._stream_subscribers.remove(callback)

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

        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    return ProcessMessage(
                        id=msg_id,
                        type=ProcessMessageType.TEXT,
                        content=block.text,
                        timestamp=timestamp,
                    )
                elif isinstance(block, ToolUseBlock):
                    return ProcessMessage(
                        id=msg_id,
                        type=ProcessMessageType.TOOL_USE,
                        content=f"调用工具: {block.name}",
                        timestamp=timestamp,
                        tool_name=block.name,
                        tool_input=block.input,
                    )

        elif isinstance(msg, ToolResultBlock):
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.TOOL_RESULT,
                content=msg.content[:500] if isinstance(msg.content, str) else str(msg.content),
                timestamp=timestamp,
                tool_name="result",
                tool_result=msg.content,
            )

        elif isinstance(msg, ResultMessage):
            return ProcessMessage(
                id=msg_id,
                type=ProcessMessageType.RESULT,
                content=msg.result or "任务完成",
                timestamp=timestamp,
                cost=msg.total_cost_usd,
            )

        return None
```

### 3. Claude SDK 客户端封装 (sdk/client.py)

```python
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

### 4. 配置模块 (config.py)

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

### 5. 数据模型 (models.py)

```python
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal
from enum import Enum
import time
import uuid

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

### 6. 思维过程流 API (api/process_stream.py)

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import json
import asyncio

router = APIRouter()

# 存储活跃的订阅者
subscribers: list = []

@router.get("/process-stream")
async def process_stream():
    """思维过程 SSE 流"""
    async def event_generator():
        queue = asyncio.Queue()
        subscribers.append(queue)

        try:
            while True:
                msg = await queue.get()
                yield {
                    "event": "message",
                    "data": json.dumps(msg.model_dump()),
                }
        except asyncio.CancelledError:
            subscribers.remove(queue)

    return EventSourceResponse(event_generator())

async def broadcast_to_subscribers(msg):
    """广播消息到所有订阅者"""
    for queue in subscribers:
        await queue.put(msg)
```

## 系统提示词文件

### 默认模板 (system_prompt.md)

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

## 依赖列表

```txt
# backend/requirements.txt

# Web 框架
fastapi>=0.104.0
uvicorn[standard]>=0.24.0

# Claude Agent SDK
claude-agent-sdk>=0.1.0

# CopilotKit SDK
copilotkit>=0.1.0

# LLM (for CopilotKit)
langchain-openai>=0.1.0

# 配置管理
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0

# 异步支持
anyio>=4.0.0
httpx>=0.25.0

# SSE 支持
sse-starlette>=1.8.0
```
