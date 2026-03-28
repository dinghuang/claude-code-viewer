# Claude Code CLI 集成设计

将后端从 echo 占位替换为真正调用 Claude Code CLI 的实现，使用户消息通过 `claude_agent_sdk.query()` 发送给 Claude Code，右侧 ProcessPanel 展示实时执行日志，CopilotChat 展示最终回复，权限请求通过 CopilotKit Action 在对话框内交互。

## 现状

`backend/app/main.py` 中的 `chat_node` 是一个 echo 占位节点：

```python
def chat_node(state: MessagesState):
    user_message = state.get("messages", [])[-1].content
    return {"messages": [AIMessage(content=f"收到消息: {user_message}")]}
```

已安装 `claude-agent-sdk==0.1.51`，已有 `ClaudeCodeAgent` 类和 `create_claude_client` 函数但未接入 LangGraph 图。

## 架构设计

### State 定义

```python
class ClaudeCodeState(MessagesState):
    system_prompt_loaded: bool          # 系统提示词是否已加载
    claude_result: str                  # Claude 最终回复文本
    claude_cost: float                  # 费用 (USD)
    claude_duration_ms: int             # 耗时 (ms)
    pending_permission: dict | None     # 等待中的权限请求
    permission_response: dict | None    # 权限响应结果
    error: str                          # 错误信息
```

### LangGraph 图结构

```
START → prepare → execute → collect → END
                     ↑
                     └── interrupt (权限请求时暂停，用户响应后恢复)
```

三个节点：

1. **prepare** — 检查 `system_prompt_loaded`，首次时将系统提示词注入
2. **execute** — 调用 `claude_agent_sdk.query()`，流式处理消息，广播到 SSE，权限请求时 interrupt
3. **collect** — 将 `claude_result` 包装为 `AIMessage` 返回 CopilotChat

### 数据流

```
用户消息 → CopilotChat → Runtime (4000) → Backend (8000)
                                              │
                                    LangGraph StateGraph:
                                    prepare → execute → collect
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                   SSE broadcast        interrupt()          AIMessage
                          │            (权限请求)                 │
                          ▼                   │                   ▼
                    ProcessPanel        CopilotKit          CopilotChat
                    (右侧面板)         Action 权限卡片       (最终回复)
```

## execute 节点实现

```python
async def execute_node(state: ClaudeCodeState):
    # 如果有 pending_permission 且有 permission_response，
    # 说明是 interrupt 恢复，继续上次的执行
    if state.get("pending_permission") and state.get("permission_response"):
        # 权限已响应，清除状态，继续执行
        return {
            "pending_permission": None,
            "permission_response": None,
        }

    prompt = state["messages"][-1].content
    settings = get_settings()

    # 权限处理器
    async def permission_handler(tool_name, tool_input, context):
        risk = get_risk_level(tool_name)
        if risk == "low":
            return PermissionResultAllow()

        # 中/高风险：设置 pending_permission 并 interrupt
        # interrupt 会暂停图，等待前端响应
        raise PermissionInterrupt(
            tool_name=tool_name,
            tool_input=tool_input,
            risk_level=risk,
        )

    options = ClaudeAgentOptions(
        model=settings.anthropic_model,
        cwd=settings.working_directory,
        system_prompt=system_prompt if not state.get("system_prompt_loaded") else None,
        can_use_tool=permission_handler,
    )

    result_text = ""
    cost = 0.0
    duration = 0

    async for msg in query(prompt=prompt, options=options):
        process_msg = convert_to_process_message(msg)
        if process_msg:
            await broadcast_to_subscribers(process_msg)

        if isinstance(msg, ResultMessage):
            result_text = msg.result or "任务完成"
            cost = msg.total_cost_usd or 0.0
            duration = msg.duration_ms or 0

    return {
        "claude_result": result_text,
        "claude_cost": cost,
        "claude_duration_ms": duration,
        "system_prompt_loaded": True,
    }
```

## 权限桥接 (CopilotKit Action)

### 后端

当 `can_use_tool` 回调触发中/高风险操作时：

1. 将权限请求信息写入 `state.pending_permission`
2. 调用 LangGraph `interrupt()` 暂停图执行
3. AG-UI 协议将 state snapshot 发送到前端（包含 pending_permission）

当前端响应后：

4. CopilotKit 通过 AG-UI `agent/connect` 恢复图执行
5. `state.permission_response` 包含用户的批准/拒绝结果
6. execute 节点读取响应，返回给 `can_use_tool`

### 前端

```tsx
// 使用 useCoagentStateRender 监听 pending_permission
useCoagentStateRender({
  name: "claude_code",
  render: ({ state }) => {
    if (!state.pending_permission) return null;
    return <PermissionCard permission={state.pending_permission} />;
  },
});

// 使用 useCopilotAction 注册权限响应
useCopilotAction({
  name: "approve_tool",
  parameters: [
    { name: "request_id", type: "string" },
    { name: "approved", type: "boolean" },
  ],
  renderAndWaitForResponse: ({ args, respond }) => {
    // 渲染权限卡片，用户点击后 respond
  },
});
```

### 权限风险等级

| 等级 | 工具 | 处理方式 |
|------|------|----------|
| 低风险 | Read, Glob, Grep, search, web_fetch | can_use_tool 内自动批准 |
| 中风险 | git, npm, pip, mkdir, mv | interrupt → CopilotKit Action |
| 高风险 | Bash, Write, Edit, rm, delete, sudo | interrupt → CopilotKit Action |

## SSE 思维过程广播

`claude_agent_sdk.query()` 流式消息 → `convert_to_process_message()` → `broadcast_to_subscribers()`:

| SDK 消息类型 | ProcessMessageType | ProcessPanel 展示 |
|---|---|---|
| ThinkingBlock | THINKING | 思考过程文本 |
| AssistantMessage (TextBlock) | TEXT | Claude 回复片段 |
| ToolUseBlock | TOOL_USE | 工具名 + 参数 |
| ToolResultBlock | TOOL_RESULT | 工具执行结果 |
| ResultMessage | RESULT | 最终结果 + 费用 |
| (error) | ERROR | 错误信息 |

## CopilotChat Loading 行为

1. 用户发消息 → CopilotChat 自动 loading（CopilotKit 内置）
2. LangGraph 执行中 → 持续 loading
3. interrupt（权限请求）→ CopilotKit 渲染权限卡片替代 loading
4. collect 节点产出 AIMessage → AG-UI MESSAGES_SNAPSHOT → CopilotChat 显示回复

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/agents/claude_code_agent.py` | 重写 | ClaudeCodeState + prepare/execute/collect 节点 + 权限桥接 + graph builder |
| `backend/app/main.py` | 重写 | 引入 ClaudeCodeAgent 的 graph，移除 echo chat_node |
| `backend/app/sdk/client.py` | 微调 | 清理无用 fallback，确保 query() 正确 |
| `frontend/src/App.tsx` | 修改 | 添加 useCoagentStateRender + 权限卡片渲染 |
| `frontend/src/components/PermissionDialog.tsx` | 重写 | 使用 CopilotKit Action 机制 |
| `backend/app/api/process_stream.py` | 保留 | 已可用 |
| `backend/app/models.py` | 保留 | 已可用 |
