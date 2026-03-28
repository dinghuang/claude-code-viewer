# 数据流设计

## 消息流向总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                          用户输入                                     │
│                       "帮我创建一个文件"                               │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Frontend (CopilotKit Chat, Port 3000)                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  用户消息 → CopilotKit Single-Route 请求                       │ │
│  │  POST http://localhost:4000/copilotkit                         │ │
│  │  {"method":"agent/run","params":{"agentId":"claude_code"},     │ │
│  │   "body":{"messages":[...],"state":{}, ...}}                   │ │
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
│  │  → chat_node 处理用户消息                                       │ │
│  │  → 返回 SSE 事件流 (RUN_STARTED, STEP_STARTED, ...)            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              AG-UI SSE 事件流 (后端 → Runtime → 前端)                  │
│                                                                      │
│  data: {"type":"RUN_STARTED","threadId":"...","runId":"..."}        │
│  data: {"type":"STEP_STARTED","stepName":"chat"}                    │
│  data: {"type":"STATE_SNAPSHOT","snapshot":{"messages":[...]}}      │
│  data: {"type":"MESSAGES_SNAPSHOT","messages":[                     │
│           {"id":"m1","role":"user","content":"帮我创建一个文件"},     │
│           {"id":"m2","role":"assistant","content":"收到消息: ..."}   │
│         ]}                                                          │
│  data: {"type":"STEP_FINISHED","stepName":"chat"}                   │
│  data: {"type":"RUN_FINISHED","threadId":"...","runId":"..."}       │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│              Frontend 渲染响应                                        │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  CopilotKit 解析 SSE 事件 → 更新聊天消息列表                    │ │
│  │  显示 Assistant 回复在 CopilotChat 组件中                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
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

通道 1: 聊天交互
  Frontend → Runtime → Backend → Runtime → Frontend
  协议: Single-Route → AG-UI SSE → Single-Route SSE

通道 2: 思维过程
  Frontend ← Backend
  协议: SSE (EventSource → /api/process-stream)
```

## AG-UI 事件类型

AG-UI 协议定义了以下事件类型：

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
| `RAW` | 原始 LangGraph 事件 | event data |

## 思维过程广播

### SSE 事件流

```
EventSource: GET /api/process-stream

event: message
data: {"id":"1","type":"text","content":"让我思考一下...","timestamp":1234567890}

event: message
data: {"id":"2","type":"tool_use","content":"调用工具: Write","tool_name":"Write","tool_input":{...}}

event: message
data: {"id":"3","type":"tool_result","content":"文件已创建","tool_result":"success"}

event: message
data: {"id":"4","type":"result","content":"任务完成","cost":0.01}
```

### ProcessMessage 类型

```python
class ProcessMessageType(str, Enum):
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    TEXT = "text"
    PERMISSION = "permission"
    RESULT = "result"
    ERROR = "error"
```

## 权限处理流程

### LangGraph 图结构

```
START → prepare → execute → permission_check → collect → END
                     ↑              │
                     └──────────────┘  (用户点"允许并重试"时，以 bypassPermissions 重跑 execute)
```

### 权限交互时序图

```
Claude CLI    execute_node    permission_check    Runtime    CopilotChat    User
    │              │                │                │           │           │
    │ ToolUseBlock │                │                │           │           │
    │─────────────>│                │                │           │           │
    │              │                │                │           │           │
    │ CLI 拒绝     │                │                │           │           │
    │ (no perm)    │                │                │           │           │
    │─────────────>│                │                │           │           │
    │              │  SSE broadcast │                │           │           │
    │              │  "权限拒绝"  ──────────────────────────────>│ ProcessPanel│
    │              │                │                │           │           │
    │ ResultMessage│                │                │           │           │
    │ (denials:[]) │                │                │           │           │
    │─────────────>│                │                │           │           │
    │              │  denials 写入   │                │           │           │
    │              │  state ────────>│                │           │           │
    │              │                │                │           │           │
    │              │                │  interrupt()   │           │           │
    │              │                │───────────────>│           │           │
    │              │                │                │  AG-UI    │           │
    │              │                │                │──────────>│           │
    │              │                │                │           │           │
    │              │                │                │  Permission Card     │
    │              │                │                │  ┌──────────────┐    │
    │              │                │                │  │ ⚠️ Write     │───>│
    │              │                │                │  │ [跳过][允许] │    │
    │              │                │                │  └──────────────┘    │
    │              │                │                │           │           │
    │              │                │                │           │  点击     │
    │              │                │                │           │ "允许并   │
    │              │                │                │           │  重试"    │
    │              │                │                │           │<──────────│
    │              │                │                │           │           │
    │              │                │  resolve()     │           │           │
    │              │                │<───────────────│<──────────│           │
    │              │                │                │           │           │
    │              │                │ retry=true     │           │           │
    │              │                │───────────────>│           │           │
    │              │                │                │           │           │
    │              │  重新执行       │                │           │           │
    │              │  (bypass mode) │                │           │           │
    │<─────────────│                │                │           │           │
    │              │                │                │           │           │
    │ 执行成功     │                │                │           │           │
    │─────────────>│                │                │           │           │
    │              │────────────────────────────────────────────>│           │
    │              │                │                │  最终回复  │           │
```

### 权限风险等级

| 等级 | 工具 | UI 表现 |
|------|------|---------|
| 高风险 | Bash, Write, Edit, delete, rm, sudo | 红色标签，需明确确认 |
| 中风险 | git, npm, pip, mkdir, mv | 黄色标签，需确认 |
| 低风险 | Read, Glob, Grep, search | 绿色标签，默认模式下自动批准 |

### 权限卡片设计

在 CopilotChat 聊天流中渲染为交互式卡片 (`useLangGraphInterrupt`)：

- 橙色渐变头部显示 "Claude 请求执行 N 个被拒绝的操作"
- 每个被拒工具显示为子卡片：风险等级标签 + 工具名 + 参数预览
- 底部两个按钮："跳过"（proceed to collect）/ "允许并重试"（re-execute with bypass）

## 错误处理

AG-UI 协议通过 `RUN_ERROR` 事件传递错误：

```
data: {"type":"RUN_ERROR","message":"HTTP 422: ...","code":"INCOMPLETE_STREAM"}
```

前端 CopilotKit 自动处理错误展示，ProcessPanel 通过独立 SSE 显示详细错误信息。
