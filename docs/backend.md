# 后端设计

## 概述

后端基于 Python FastAPI 构建，使用 AG-UI 协议与 CopilotKit Runtime 通信，通过 LangGraph 编排 Agent 逻辑，调用真实的 Claude Code CLI。

**核心技术栈：**
- Python 3.12 (CopilotKit SDK 要求 <3.13)
- FastAPI + ag-ui-langgraph
- LangGraph StateGraph (prepare → execute → collect)
- claude-agent-sdk 0.1.51 (调用 Claude Code CLI)
- copilotkit 0.1.83

## 模块结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口 + AG-UI 端点注册
│   ├── config.py               # Pydantic Settings 配置管理
│   ├── models.py               # ProcessMessage 数据模型
│   ├── agents/                 # LangGraph Agent
│   │   ├── __init__.py
│   │   └── claude_code_agent.py  # ClaudeCodeState + 3 nodes + build_graph()
│   ├── sdk/                    # Claude SDK 封装
│   │   ├── __init__.py
│   │   └── client.py             # build_claude_options() helper
│   └── api/
│       ├── __init__.py
│       └── process_stream.py   # SSE 思维过程流
│
├── system_prompt.md            # 系统提示词配置
├── requirements.txt
├── .env.example
├── .env
└── venv/                       # Python 3.12 虚拟环境
```

## 核心模块

### 1. FastAPI 入口 (main.py)

主入口负责创建 FastAPI 应用、注册 AG-UI 端点和 SSE 流端点。

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.messages import AIMessage
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

app = FastAPI(title="Claude Code Viewer", version="0.3.0")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# SSE 思维过程路由
app.include_router(process_stream.router, prefix="/api", tags=["stream"])

# LangGraph Agent 定义
def chat_node(state: MessagesState):
    user_message = state.get("messages", [])[-1].content
    return {"messages": [AIMessage(content=f"收到消息: {user_message}")]}

graph = StateGraph(MessagesState)
graph.add_node("chat", chat_node)
graph.add_edge(START, "chat")
graph.add_edge("chat", END)
compiled_graph = graph.compile(checkpointer=MemorySaver())

# 创建 AG-UI Agent 并注册端点
agent = LangGraphAgent(
    name="claude_code",
    description="Claude Code 助手 - 执行代码任务",
    graph=compiled_graph,
)
add_langgraph_fastapi_endpoint(app, agent, path="/")
```

**关键 API：**

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /` | AG-UI | Agent 执行端点 (由 Runtime 调用) |
| `GET /health` | REST | 健康检查 |
| `GET /api/process-stream` | SSE | 思维过程实时流 |
| `GET /api/system-prompt` | REST | 获取当前系统提示词 |
| `POST /api/system-prompt` | REST | 更新系统提示词 (前端浮窗调用) |

### 2. AG-UI 端点 (`add_langgraph_fastapi_endpoint`)

`ag-ui-langgraph` 包的 `add_langgraph_fastapi_endpoint` 自动注册：
- `POST /` — 接收 `RunAgentInput`，返回 SSE 事件流
- `GET /health` — Agent 健康检查

**RunAgentInput 必填字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `threadId` | string | 对话线程 ID |
| `runId` | string | 本次运行 ID |
| `state` | object | Agent 状态 |
| `messages` | array | 消息列表 |
| `tools` | array | 可用工具列表 |
| `context` | array | 上下文信息 |
| `forwardedProps` | object | 转发属性 |

### 3. LangGraph Agent

Agent 逻辑以 LangGraph `StateGraph` 定义，三个异步节点：

- **prepare_node** — 加载系统提示词（前端覆盖 > 文件 fallback），广播到 SSE
- **execute_node** — 调用 `claude_agent_sdk.query()` 与真实 Claude Code CLI 交互，流式广播所有消息到 ProcessPanel
- **collect_node** — 将 Claude 最终结果包装为 AIMessage 返回 CopilotChat

```python
# execute_node 核心逻辑
async for msg in query(prompt=user_message, options=options):
    process_msg = convert_to_process_message(msg)  # SDK msg → ProcessMessage
    if process_msg:
        await broadcast_to_subscribers(process_msg)  # → SSE → ProcessPanel
    if isinstance(msg, ResultMessage):
        result_text = msg.result  # 最终结果 → collect_node → AIMessage
```

### 系统提示词 API

后端维护一个内存中的系统提示词存储，支持前端实时编辑：

```python
# 优先级: 前端覆盖 > 文件 fallback
def get_effective_system_prompt() -> Optional[str]:
    if _system_prompt_override is not None:
        return _system_prompt_override
    return get_settings().get_system_prompt()
```

**AG-UI 事件流输出示例：**

```
data: {"type":"RUN_STARTED","threadId":"...","runId":"..."}
data: {"type":"STEP_STARTED","stepName":"chat"}
data: {"type":"STATE_SNAPSHOT","snapshot":{...}}
data: {"type":"MESSAGES_SNAPSHOT","messages":[...]}
data: {"type":"STEP_FINISHED","stepName":"chat"}
data: {"type":"RUN_FINISHED","threadId":"...","runId":"..."}
```

### 4. 思维过程 SSE 流 (api/process_stream.py)

独立的 SSE 端点，用于广播 Claude SDK 的思维过程到前端 ProcessPanel。

```python
from fastapi import APIRouter
from sse_starlette import EventSourceResponse
import json
import asyncio

router = APIRouter()
_subscribers: List[asyncio.Queue] = []

@router.get("/process-stream")
async def process_stream():
    async def event_generator():
        queue = asyncio.Queue()
        _subscribers.append(queue)
        try:
            while True:
                msg = await queue.get()
                yield {"event": "message", "data": json.dumps(msg.model_dump())}
        except asyncio.CancelledError:
            if queue in _subscribers:
                _subscribers.remove(queue)
    return EventSourceResponse(event_generator())

async def broadcast_to_subscribers(msg: ProcessMessage):
    for queue in _subscribers:
        await queue.put(msg)
```

### 5. 配置模块 (config.py)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Claude Code SDK
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    # 工作目录
    claude_code_cli_path: Optional[str] = None
    working_directory: str = "."

    # CopilotKit LLM (可选)
    copilotkit_llm_api_key: Optional[str] = None
    copilotkit_llm_base_url: Optional[str] = None
    copilotkit_llm_model: str = "claude-sonnet-4-5"

    # 系统提示词
    system_prompt_path: str = "./system_prompt.md"

    class Config:
        env_file = ".env"
```

## 依赖列表

```txt
# backend/requirements.txt

# Web 框架
fastapi>=0.115.0
uvicorn[standard]>=0.24.0

# Claude Agent SDK
claude-agent-sdk>=0.1.0

# CopilotKit + AG-UI 集成
copilotkit>=0.1.83
ag-ui-langgraph>=0.0.27

# LangGraph
langgraph>=1.0.0
langchain-core>=1.2.0

# 配置管理
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0

# 异步 & HTTP
anyio>=4.0.0
httpx>=0.25.0

# SSE
sse-starlette>=1.8.0
```

## 启动

```bash
cd backend

# 创建 Python 3.12 虚拟环境
python3.12 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env

# 启动
uvicorn app.main:app --reload --port 8000
```

## 注意事项

- **Python 版本**：必须使用 Python 3.10-3.12，CopilotKit SDK 不支持 3.13+
- **AG-UI 端点注册在 `/`**：Runtime 的 `LangGraphHttpAgent` 默认发送请求到根路径
- **MemorySaver** 仅用于开发环境，生产环境需要持久化 checkpointer
