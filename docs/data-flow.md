# 数据流设计

## 消息流向总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                            用户输入                                  │
│                         "帮我创建一个文件"                            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (CopilotKit Chat)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CopilotKit.query()                                          │   │
│  │  → POST /copilotkit/agent/claude_code                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend (ClaudeCodeAgent)                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. ClaudeSDKClient.query(user_message)                     │   │
│  │  2. Claude Code CLI 开始处理                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Claude SDK 消息流                                 │
│                                                                     │
│  AssistantMessage ─────────────────────────────────────────────┐   │
│    └─ TextBlock: "我需要创建一个文件..."                          │   │
│                                                                 │   │
│  AssistantMessage ─────────────────────────────────────────────┐   │
│    └─ ToolUseBlock: Write                                      │   │
│         └─ file_path: "/path/to/file.txt"                      │   │
│         └─ content: "..."                                      │   │
│                                                                 │   │
│  SystemMessage (control) ──────────────────────────────────────┐   │
│    └─ subtype: "can_use_tool"                                  │   │
│    └─ tool_name: "Write"                                       │   │
│    └─ tool_input: {...}                                        │   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│   权限请求流程                 │   │   思维过程广播                │
│                              │   │                              │
│   can_use_tool callback      │   │   SSE /process-stream        │
│          │                   │   │          │                   │
│          ▼                   │   │          ▼                   │
│   触发 CopilotKit Action     │   │   ProcessPanel 更新          │
│          │                   │   │   - 显示思考内容              │
│          ▼                   │   │   - 显示工具调用              │
│   前端 PermissionCard         │   │   - 显示工具结果              │
│          │                   │   │                              │
│          ▼                   │   │                              │
│   用户确认/拒绝               │   │                              │
│          │                   │   │                              │
│          ▼                   │   │                              │
│   返回 PermissionResult      │   │                              │
│                              │   │                              │
└──────────────────────────────┘   └──────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Claude 继续执行                                   │
│                                                                     │
│  ToolResultBlock ───────────────────────────────────────────────    │
│    └─ content: "文件已创建"                                          │
│                                                                     │
│  ResultMessage ──────────────────────────────────────────────────   │
│    └─ result: "任务完成"                                             │
│    └─ total_cost_usd: 0.01                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Frontend (CopilotKit Chat)                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  显示最终结果                                                  │   │
│  │  SummaryCard: 任务完成，文件已创建                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 消息类型定义

### Claude SDK 原始消息

```python
# 来自 claude-agent-sdk-python

@dataclass
class UserMessage:
    content: str | list[ContentBlock]
    uuid: str | None = None

@dataclass
class AssistantMessage:
    content: list[ContentBlock]  # TextBlock, ToolUseBlock, ThinkingBlock
    model: str
    stop_reason: str | None = None

@dataclass
class ToolResultBlock:
    tool_use_id: str
    content: str | list[dict] | None
    is_error: bool | None = None

@dataclass
class ResultMessage:
    subtype: str
    duration_ms: int
    is_error: bool
    result: str | None = None
    total_cost_usd: float | None = None
```

### 内部处理消息

```python
# backend/app/models.py

class ProcessMessageType(str, Enum):
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    TEXT = "text"
    PERMISSION = "permission"
    RESULT = "result"
    ERROR = "error"

@dataclass
class ProcessMessage:
    id: str
    type: ProcessMessageType
    content: str
    timestamp: int

    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None
    risk_level: Optional[str] = None
    actions: Optional[List[str]] = None
    cost: Optional[float] = None
```

## 权限处理流程

### 详细时序图

```
Claude SDK     ClaudeCodeAgent     CopilotKit     Frontend      User
    │                │                  │             │           │
    │  ToolUseBlock  │                  │             │           │
    │───────────────>│                  │             │           │
    │                │                  │             │           │
    │                │ can_use_tool()   │             │           │
    │                │ callback         │             │           │
    │                │                  │             │           │
    │                │  request_permission Action     │           │
    │                │─────────────────>│             │           │
    │                │                  │             │           │
    │                │                  │ render()    │           │
    │                │                  │────────────>│           │
    │                │                  │             │           │
    │                │                  │             │ Show Card │
    │                │                  │             │──────────>│
    │                │                  │             │           │
    │                │                  │             │  Approve  │
    │                │                  │             │<──────────│
    │                │                  │             │           │
    │                │                  │  respond()  │           │
    │                │                  │<────────────│           │
    │                │                  │             │           │
    │                │ PermissionResult │             │           │
    │                │<─────────────────│             │           │
    │                │                  │             │           │
    │  Continue      │                  │             │           │
    │<───────────────│                  │             │           │
    │                │                  │             │           │
```

### 权限风险等级

```python
def get_risk_level(tool_name: str) -> str:
    HIGH_RISK = {
        "Bash",       # 执行任意命令
        "Write",      # 写入文件
        "Edit",       # 编辑文件
        "delete_file" # 删除文件
    }
    MEDIUM_RISK = {
        "git",        # Git 操作
        "npm",        # NPM 操作
        "pip",        # Pip 操作
    }
    LOW_RISK = {
        "Read",       # 读取文件
        "LS",         # 列出目录
        "Glob",       # 文件匹配
        "Grep",       # 搜索
    }

    if tool_name in HIGH_RISK:
        return "high"
    elif tool_name in MEDIUM_RISK:
        return "medium"
    return "low"
```

## 思维过程广播

### SSE 事件流

```
EventSource: /api/process-stream

event: message
data: {"id":"1","type":"text","content":"让我思考一下...","timestamp":1234567890}

event: message
data: {"id":"2","type":"tool_use","content":"调用工具: Write","tool_name":"Write","tool_input":{"file_path":"test.txt"}}

event: message
data: {"id":"3","type":"tool_result","content":"文件已创建","tool_result":"success"}

event: message
data: {"id":"4","type":"result","content":"任务完成","cost":0.01}
```

### 广播实现

```python
# backend/app/agents/claude_code_agent.py

class ClaudeCodeAgent:
    def __init__(self):
        self._stream_subscribers: List = []

    def subscribe(self, callback):
        """订阅思维过程流"""
        self._stream_subscribers.append(callback)
        return lambda: self._stream_subscribers.remove(callback)

    async def _broadcast(self, msg: ProcessMessage):
        """广播到所有订阅者"""
        for subscriber in self._stream_subscribers:
            try:
                await subscriber(msg)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")

    async def execute(self, messages, thread_id, state, **kwargs):
        # ... 创建客户端 ...

        async for msg in client.receive_messages():
            process_msg = self._convert_to_process_message(msg)
            if process_msg:
                await self._broadcast(process_msg)
```

## 错误处理

### 错误类型

```python
class ProcessErrorType(str, Enum):
    CONNECTION_ERROR = "connection_error"    # 连接失败
    CLI_ERROR = "cli_error"                  # CLI 执行错误
    PERMISSION_DENIED = "permission_denied"  # 权限被拒绝
    TIMEOUT = "timeout"                      # 超时
    UNKNOWN = "unknown"                      # 未知错误

@dataclass
class ProcessError:
    type: ProcessErrorType
    message: str
    details: Optional[Dict[str, Any]] = None
```

### 错误处理流程

```python
async def execute_with_error_handling(self, messages, thread_id, state, **kwargs):
    try:
        async for result in self.execute(messages, thread_id, state, **kwargs):
            yield result

    except CLINotFoundError:
        error_msg = ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.ERROR,
            content="Claude Code CLI 未安装",
            timestamp=int(time.time() * 1000),
        )
        await self._broadcast(error_msg)

    except CLIConnectionError as e:
        error_msg = ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.ERROR,
            content=f"连接失败: {str(e)}",
            timestamp=int(time.time() * 1000),
        )
        await self._broadcast(error_msg)

    except asyncio.TimeoutError:
        error_msg = ProcessMessage(
            id=str(uuid.uuid4()),
            type=ProcessMessageType.ERROR,
            content="操作超时",
            timestamp=int(time.time() * 1000),
        )
        await self._broadcast(error_msg)
```

## 性能优化

### 消息节流

```python
from asyncio import Queue
import asyncio

class ThrottledBroadcaster:
    """节流广播器 - 避免消息过多"""

    def __init__(self, interval: float = 0.1):
        self._queue = Queue()
        self._interval = interval
        self._running = False

    async def start(self):
        self._running = True
        asyncio.create_task(self._process_queue())

    async def _process_queue(self):
        while self._running:
            msg = await self._queue.get()
            await self._broadcast(msg)
            await asyncio.sleep(self._interval)

    async def emit(self, msg: ProcessMessage):
        await self._queue.put(msg)
```

### 消息压缩

```python
def compress_tool_result(result: Any, max_length: int = 500) -> str:
    """压缩工具结果"""
    if isinstance(result, str):
        if len(result) > max_length:
            return result[:max_length] + f"\n... (截断，共 {len(result)} 字符)"
        return result
    return str(result)[:max_length]
```
