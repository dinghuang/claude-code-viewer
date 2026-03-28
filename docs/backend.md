# 后端设计

## 概述

后端基于 Python FastAPI 构建，使用 AG-UI 协议与 CopilotKit Runtime 通信，通过 LangGraph 编排 Agent 逻辑，调用 Claude Code CLI 执行投资研究任务。支持 Session 复用保持对话上下文。

**核心技术栈：**
- Python 3.12 (CopilotKit SDK 要求 <3.13)
- FastAPI + ag-ui-langgraph
- LangGraph StateGraph (prepare → execute → permission_check → collect)
- claude-agent-sdk (调用 Claude Code CLI，支持 session resume)
- copilotkit 0.1.83
- 6 个金融 MCP 服务器

## 模块结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口 + AG-UI 端点 + REST API
│   ├── config.py               # Pydantic Settings (含 user_info_path)
│   ├── models.py               # ProcessMessage 数据模型
│   ├── agents/
│   │   ├── __init__.py
│   │   └── claude_code_agent.py  # LangGraph Agent (4 nodes + session 复用)
│   ├── sdk/
│   │   ├── __init__.py
│   │   └── client.py             # build_claude_options() + MCP 配置
│   └── api/
│       ├── __init__.py
│       └── process_stream.py   # SSE 思维过程广播
│
├── system_prompt.md            # 系统提示词 (投资研究技能配置)
├── user_info.md                # 用户画像 (客户资产/偏好)
├── requirements.txt
├── .env.example
└── .env
```

## 核心模块

### 1. FastAPI 入口 (main.py)

```python
app = FastAPI(title="Claude Code Viewer", version="0.4.0")

# CORS 中间件
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# SSE 思维过程路由
app.include_router(process_stream.router, prefix="/api")

# LangGraph Agent + AG-UI 端点
compiled_graph = build_graph()
agent = LangGraphAgent(name="claude_code", graph=compiled_graph)
add_langgraph_fastapi_endpoint(app, agent, path="/")
```

**API 端点：**

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /` | AG-UI | Agent 执行端点 (由 Runtime 调用) |
| `GET /health` | REST | 健康检查 |
| `GET /api/process-stream` | SSE | 思维过程实时流 |
| `GET /api/user-info` | REST | 从 `user_info.md` 读取用户画像 (无缓存) |
| `GET /api/system-prompt` | REST | 从 `system_prompt.md` 读取系统提示词 (无缓存) |
| `POST /api/system-prompt` | REST | 更新系统提示词 (前端拼接后发送) |
| `GET /api/permission-mode` | REST | 获取当前权限模式 |
| `POST /api/permission-mode` | REST | 更新权限模式 |

### 2. LangGraph Agent (agents/claude_code_agent.py)

#### State 定义

```python
class ClaudeCodeState(MessagesState):
    system_prompt_loaded: bool
    claude_session_id: Optional[str]  # SDK session ID，用于 session 复用
    claude_result: str
    claude_cost: float
    claude_duration_ms: int
    permission_denials: list
    retry_with_bypass: bool
    pending_permission: Optional[Dict[str, Any]]
    permission_response: Optional[Dict[str, Any]]
    error: str
```

#### 图结构

```
START → prepare → execute → permission_check ──→ collect → END
                     ↑              │
                     └──────────────┘  (retry_with_bypass=True)
```

#### 节点说明

**prepare_node** — 首次对话加载系统提示词，广播加载通知到 SSE

**execute_node** — 核心执行节点：
- 从 state 获取 `claude_session_id`，有则用 `resume` 复用 session
- 首次对话传递 `system_prompt`，后续 resume 不再传
- 调用 `claude_agent_sdk.query()`，流式广播所有消息到 ProcessPanel
- 从 `SystemMessage(init)` 捕获 `session_id` 存入 state

```python
# Session 复用逻辑
existing_session_id = state.get("claude_session_id")

if existing_session_id:
    extra_opts["resume"] = existing_session_id  # 复用 session
else:
    extra_opts["system_prompt"] = system_prompt  # 首次传提示词

options = ClaudeAgentOptions(**base_opts, permission_mode=perm_mode, **extra_opts)

async for msg in query(prompt=user_message, options=options):
    # 捕获 session_id
    if isinstance(msg, ClaudeSystemMessage) and msg.subtype == 'init':
        captured_session_id = msg.data['session_id']

    # 广播到 SSE
    for process_msg in convert_to_process_messages(msg):
        await broadcast_to_subscribers(process_msg)
```

**permission_check_node** — 检查权限拒绝列表：
- 有拒绝 → `interrupt()` 暂停图，等待前端用户审批
- 用户批准 → `retry_with_bypass=True`，回到 execute 以 bypass 模式重跑
- 用户拒绝 → 进入 collect

**collect_node** — 将 `claude_result` 包装为 `AIMessage` 返回 CopilotChat

#### 消息转换器

`convert_to_process_messages(msg)` 将 Claude SDK 消息转为 `ProcessMessage`：

| SDK 消息类型 | ProcessMessage 类型 | 说明 |
|-------------|---------------------|------|
| `AssistantMessage → ThinkingBlock` | `thinking` | Claude 思考过程 |
| `AssistantMessage → ToolUseBlock` | `tool_use` | 工具调用 (MCP 工具名) |
| `AssistantMessage → TextBlock` | `text` | 文本回复 |
| `UserMessage → ToolResultBlock` | `tool_result` / `permission` | 工具结果/权限拒绝 |
| `SystemMessage (init)` | `text` | 会话初始化信息 |
| `ResultMessage` | `result` | 执行结果 (cost/duration/turns) |

### 3. 系统提示词管理

```python
# 内存存储
_system_prompt_override: Optional[str] = None

def set_system_prompt(prompt: str):
    global _system_prompt_override
    _system_prompt_override = prompt

def get_effective_system_prompt() -> Optional[str]:
    if _system_prompt_override is not None:
        return _system_prompt_override     # 前端设置优先
    return get_settings().get_system_prompt()  # 文件 fallback
```

**优先级**: 前端 POST 覆盖 > `system_prompt.md` 文件

**前端拼接**: 前端将 `用户信息 + "---" + 系统提示词` 拼接为完整提示词 POST 到后端。

### 4. 用户信息 API

```python
@app.get("/api/user-info")
async def get_user_info():
    info = settings.get_user_info()  # 直接读文件，无缓存
    return {"content": info or ""}
```

每次请求都从 `user_info.md` 实时读取，确保修改文件后立即生效。

### 5. 思维过程 SSE 流 (api/process_stream.py)

```python
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
            _subscribers.remove(queue)
    return EventSourceResponse(event_generator())

async def broadcast_to_subscribers(msg: ProcessMessage):
    for queue in _subscribers:
        await queue.put(msg)
```

### 6. 配置模块 (config.py)

```python
class Settings(BaseSettings):
    # Claude Code SDK
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    # Claude Code CLI
    claude_code_cli_path: Optional[str] = None
    working_directory: str = "."
    claude_code_mcp_servers: Optional[str] = None  # JSON 字符串

    # CopilotKit LLM (可选)
    copilotkit_llm_api_key: Optional[str] = None
    copilotkit_llm_base_url: Optional[str] = None
    copilotkit_llm_model: str = "claude-sonnet-4-5"

    # 文件路径
    system_prompt_path: str = "./system_prompt.md"
    user_info_path: str = "./user_info.md"

    class Config:
        env_file = ".env"
```

### 7. SDK 选项构建 (sdk/client.py)

```python
def build_claude_options():
    settings = get_settings()
    os.environ.setdefault("ANTHROPIC_API_KEY", settings.anthropic_api_key)
    os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", settings.anthropic_auth_token)
    os.environ.setdefault("ANTHROPIC_BASE_URL", settings.anthropic_base_url)

    opts = {"model": settings.anthropic_model, "cwd": settings.working_directory}

    if settings.claude_code_mcp_servers:
        mcp = json.loads(settings.claude_code_mcp_servers)
        opts["mcp_servers"] = mcp  # 传递 MCP 服务器配置

    return opts
```

## 依赖列表

```txt
fastapi>=0.115.0
uvicorn[standard]>=0.24.0
claude-agent-sdk>=0.1.0
copilotkit>=0.1.83
ag-ui-langgraph>=0.0.27
langgraph>=1.0.0
langchain-core>=1.2.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
anyio>=4.0.0
httpx>=0.25.0
sse-starlette>=1.8.0
```

## 启动

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 编辑 .env 配置 API Key
uvicorn app.main:app --reload --port 8000
```

## 注意事项

- **Python 版本**：必须使用 Python 3.10-3.12，CopilotKit SDK 不支持 3.13+
- **AG-UI 端点注册在 `/`**：Runtime 的 `LangGraphHttpAgent` 默认发送请求到根路径
- **MemorySaver** 仅用于开发环境，生产环境需要持久化 checkpointer
- **Session 复用**：依赖 LangGraph State 中的 `claude_session_id`，页面刷新时重置
- **文件读取无缓存**：`GET /api/user-info` 和 `GET /api/system-prompt` 每次都实时读文件
