# 数据流设计

## 消息流向总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户输入                                     │
│                    "帮我分析一下新能源ETF"                              │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Frontend (CopilotKit Chat, Port 3000)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  用户消息 → CopilotKit Single-Route 请求                       │ │
│  │  POST http://localhost:4000/copilotkit                         │ │
│  │  {"method":"agent/run","params":{"agentId":"claude_code"},     │ │
│  │   "body":{"messages":[...],"state":{}, "threadId":"session-*"}}│ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│           CopilotKit Runtime (Node.js, Port 4000)                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  解析 Single-Route 请求 → 提取 agentId + body                  │ │
│  │  转发为 AG-UI 请求 → POST http://localhost:8000/               │ │
│  │  接收 SSE 事件流 → 转换为 Single-Route SSE 响应                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│             Backend (Python FastAPI, Port 8000)                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  AG-UI 端点接收 RunAgentInput                                   │ │
│  │  → LangGraphAgent.run() → 执行 StateGraph                      │ │
│  │  → prepare → execute (claude_agent_sdk) → permission_check     │ │
│  │  → collect → 返回 AIMessage                                    │ │
│  │  → SSE 事件流 (RUN_STARTED, STEP_STARTED, ...)                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              AG-UI SSE 事件流 (后端 → Runtime → 前端)                  │
│                                                                      │
│  data: {"type":"RUN_STARTED","threadId":"...","runId":"..."}        │
│  data: {"type":"STEP_STARTED","stepName":"prepare"}                 │
│  data: {"type":"STEP_FINISHED","stepName":"prepare"}                │
│  data: {"type":"STEP_STARTED","stepName":"execute"}                 │
│  data: {"type":"STATE_SNAPSHOT","snapshot":{"messages":[...]}}      │
│  data: {"type":"STEP_FINISHED","stepName":"execute"}                │
│  data: {"type":"MESSAGES_SNAPSHOT","messages":[...]}                │
│  data: {"type":"RUN_FINISHED","threadId":"...","runId":"..."}       │
└──────────────────────────────────────────────────────────────────────┘
```

## 双通道数据流

前端同时维护两条数据通道：

```
                    ┌─────────────────────┐
                    │   Frontend (3000)    │
                    │                     │
                    │  CopilotChat   ProcessPanel
                    │      │              │
                    └──────┼──────────────┼──────┘
                           │              │
          Single-Route     │              │  SSE
          (via Runtime)    │              │  (直连后端)
                           ▼              ▼
                    ┌─────────────┐  ┌─────────────┐
                    │ Runtime     │  │ Backend     │
                    │ (4000)      │  │ (8000)      │
                    └──────┬──────┘  │ /api/       │
                           │ AG-UI   │ process-    │
                           └────────>│ stream      │
                                     └─────────────┘

通道 1: 对话交互
  Frontend → Runtime → Backend → Runtime → Frontend
  协议: Single-Route → AG-UI SSE → Single-Route SSE

通道 2: 思维过程
  Frontend ← Backend
  协议: SSE (EventSource → /api/process-stream)
```

## Session 复用机制

### 前端 threadId

前端在页面加载时生成一个稳定的 `SESSION_THREAD_ID`，传给 CopilotKit：

```typescript
const SESSION_THREAD_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

<CopilotKit runtimeUrl="..." agent="claude_code" threadId={SESSION_THREAD_ID}>
```

同一页面会话内所有消息共享同一个 `threadId`，CopilotKit 和 LangGraph 使用此 ID 维护对话状态。

### 后端 Claude Session 复用

LangGraph State 中存储 `claude_session_id`：

```
第 1 条消息:
  execute_node → query(prompt=..., options=ClaudeAgentOptions(...))
  → 从 SystemMessage(init) 捕获 session_id → 存入 state.claude_session_id

第 2+ 条消息:
  execute_node → 从 state 获取 claude_session_id
  → query(prompt=..., options=ClaudeAgentOptions(resume=session_id))
  → 复用已有 session，保持对话上下文

页面刷新:
  → 新 threadId → 新 LangGraph thread → 无 claude_session_id → 创建新 session
```

## AG-UI 事件类型

| 事件 | 说明 | 数据 |
|------|------|------|
| `RUN_STARTED` | Agent 执行开始 | threadId, runId |
| `RUN_FINISHED` | Agent 执行结束 | threadId, runId |
| `RUN_ERROR` | Agent 执行出错 | message, code |
| `STEP_STARTED` | LangGraph 节点开始 | stepName |
| `STEP_FINISHED` | LangGraph 节点结束 | stepName |
| `STATE_SNAPSHOT` | 状态快照 | snapshot (messages, tools) |
| `MESSAGES_SNAPSHOT` | 消息快照 | messages[] |
| `TEXT_MESSAGE_START` | 文本消息开始 | messageId, role |
| `TEXT_MESSAGE_CONTENT` | 文本消息内容 (流式) | delta |
| `TEXT_MESSAGE_END` | 文本消息结束 | messageId |

## 思维过程广播

### SSE 事件流

```
EventSource: GET /api/process-stream

event: message
data: {"id":"1","type":"text","content":"[会话初始化] 工作目录: ...","timestamp":1234567890}

event: message
data: {"id":"2","type":"thinking","content":"让我分析新能源ETF...","timestamp":1234567891}

event: message
data: {"id":"3","type":"tool_use","content":"调用工具: gf_etfrank","tool_name":"gf_etfrank","tool_input":{...}}

event: message
data: {"id":"4","type":"tool_result","content":"ETF排行数据...","tool_result":"..."}

event: message
data: {"id":"5","type":"result","content":"任务完成 ($0.0234, 5.2s, 3 turns)","cost":0.0234}
```

### ProcessMessage 类型

```python
class ProcessMessageType(str, Enum):
    THINKING = "thinking"       # Claude 思考过程
    TOOL_USE = "tool_use"       # 工具调用 (MCP 工具名 + 参数)
    TOOL_RESULT = "tool_result" # 工具执行结果
    TEXT = "text"               # 文本消息 (会话初始化、系统信息)
    PERMISSION = "permission"   # 权限拒绝通知
    RESULT = "result"           # 最终执行结果 (含 cost/duration)
    ERROR = "error"             # 错误信息
```

## 权限处理流程

### LangGraph 图结构

```
START → prepare → execute → permission_check → collect → END
                     ↑              │
                     └──────────────┘  (用户点"允许并重试"→ bypassPermissions 重跑)
```

### 权限交互时序

```
Claude CLI    execute_node    permission_check    Runtime    CopilotChat    User
    │              │                │                │           │           │
    │ ToolUseBlock │                │                │           │           │
    │─────────────>│  SSE broadcast │                │           │           │
    │              │───────────────────────────────────────────> ProcessPanel│
    │              │                │                │           │           │
    │ CLI 拒绝工具 │                │                │           │           │
    │─────────────>│                │                │           │           │
    │              │                │                │           │           │
    │ ResultMessage│                │                │           │           │
    │ (denials:[]) │                │                │           │           │
    │─────────────>│  denials→state │                │           │           │
    │              │───────────────>│                │           │           │
    │              │                │  interrupt()   │           │           │
    │              │                │───────────────>│  AG-UI    │           │
    │              │                │                │──────────>│           │
    │              │                │                │  Permission Card     │
    │              │                │                │  ┌──────────────┐    │
    │              │                │                │  │ ⚠️ Write     │───>│
    │              │                │                │  │ [跳过][允许] │    │
    │              │                │                │  └──────────────┘    │
    │              │                │                │           │  允许    │
    │              │                │  resolve()     │           │<─────────│
    │              │                │<───────────────│<──────────│           │
    │              │  重新执行       │                │           │           │
    │              │  (bypass mode) │                │           │           │
    │<─────────────│                │                │           │           │
    │ 执行成功     │                │                │           │           │
    │─────────────>│────────────────────────────────────────────>│           │
    │              │                │                │  最终回复  │           │
```

### 权限风险等级

| 等级 | 工具 | UI 表现 |
|------|------|---------|
| 高风险 | Bash, Write, Edit, delete, rm, sudo | 红色标签，需明确确认 |
| 中风险 | git, npm, pip, mkdir, mv | 黄色标签，需确认 |
| 低风险 | Read, Glob, Grep, search | 绿色标签，默认模式下自动批准 |

## 设置数据流

### 页面加载

```
Frontend mount
  → GET /api/user-info      → 读取 backend/user_info.md (无缓存)
  → GET /api/system-prompt   → 读取 backend/system_prompt.md (无缓存)
  → 存入 state + defaultState
  → POST /api/system-prompt  → 拼接后发送给后端内存
  → POST /api/permission-mode → 默认 bypassPermissions
```

### 用户保存设置

```
用户点"保存"
  → 拼接 userInfo + systemPrompt (用 "---" 分隔)
  → POST /api/system-prompt  → 更新后端内存 (不写文件)
  → POST /api/permission-mode → 更新后端内存
  → 前端 state 更新 (仅缓存)
  → 下次 Agent 执行时使用新提示词
```

### 页面刷新

```
刷新页面
  → 重新从文件 API 读取 → 重置为文件内容
  → 新 threadId → 新 LangGraph thread → 新 Claude session
```

## 错误处理

AG-UI 协议通过 `RUN_ERROR` 事件传递错误：

```
data: {"type":"RUN_ERROR","message":"HTTP 422: ...","code":"INCOMPLETE_STREAM"}
```

前端 CopilotKit 自动处理错误展示，ProcessPanel 通过独立 SSE 显示详细错误信息。
