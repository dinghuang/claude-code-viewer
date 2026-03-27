# CopilotKit 集成

## 概述

本项目使用 CopilotKit 作为前端交互层，提供美化的聊天界面和丰富的交互组件。

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (React)                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CopilotKit Provider                                      │ │
│  │  ┌─────────────────┐  ┌────────────────────────────────┐ │ │
│  │  │ CopilotChat     │  │ CopilotAction                  │ │ │
│  │  │ - Chat UI       │  │ - PermissionCard               │ │ │
│  │  │ - Messages      │  │ - SelectionCard                │ │ │
│  │  │ - Input         │  │ - ProgressCard                 │ │ │
│  │  └─────────────────┘  └────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ AG-UI Protocol (SSE)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CopilotKitRemoteEndpoint                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │  ClaudeCodeAgent (CopilotKit Agent)                 │ │ │
│  │  │  ├── execute() → 执行 Claude 任务                   │ │ │
│  │  │  └── 权限请求 → CopilotKit Action                   │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 前端集成

### 1. 安装依赖

```bash
npm install @copilotkit/react-core @copilotkit/react-ui
```

### 2. 配置 Provider

```tsx
// App.tsx
import { CopilotKit } from "@copilotkit/react";

export default function App() {
  return (
    <CopilotKit
      publicApiKey={import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY}
      agent="claude_code"
      runtimeUrl={import.meta.env.VITE_API_URL + "/copilotkit"}
    >
      {/* 应用组件 */}
    </CopilotKit>
  );
}
```

### 3. 使用聊天组件

```tsx
import { CopilotPopup } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

export function Chat() {
  return (
    <CopilotPopup
      instructions="你是一个 Claude Code 助手"
      labels={{
        title: "Claude Code",
        initial: "有什么我可以帮你的？",
        placeholder: "输入你的问题...",
      }}
      defaultOpen={true}
    />
  );
}
```

## 后端集成

### 1. 安装依赖

```bash
pip install copilotkit langchain-openai
```

### 2. 创建 Endpoint

```python
from copilotkit import CopilotKitRemoteEndpoint
from langchain_openai import ChatOpenAI

def create_copilotkit_endpoint():
    llm = ChatOpenAI(
        api_key=settings.copilotkit_llm_api_key,
        base_url=settings.copilotkit_llm_base_url,
        model=settings.copilotkit_llm_model,
    )

    return CopilotKitRemoteEndpoint(
        agents=[
            ClaudeCodeAgent(
                name="claude_code",
                description="Claude Code 助手",
                llm=llm,
            )
        ],
    )
```

### 3. 注册到 FastAPI

```python
from copilotkit.integrations.fastapi import add_fastapi_endpoint

app = FastAPI()
sdk = create_copilotkit_endpoint()
add_fastapi_endpoint(app, sdk, "/copilotkit")
```

## 自定义 Agent

### Agent 基类

```python
from copilotkit import Agent
from abc import abstractmethod

class ClaudeCodeAgent(Agent):
    def __init__(self, name, description, llm):
        super().__init__(name=name, description=description)
        self.llm = llm

    @abstractmethod
    async def execute(
        self,
        messages: List[Dict],
        thread_id: str,
        state: Dict,
        **kwargs
    ):
        """执行 Agent - 返回生成器"""
        pass
```

### 实现示例

```python
async def execute(self, messages, thread_id, state, **kwargs):
    user_message = messages[-1]["content"]

    # 调用 Claude SDK
    client = create_claude_client(
        can_use_tool=self._handle_permission,
    )

    async with client:
        await client.query(user_message, session_id=thread_id)

        async for msg in client.receive_messages():
            # 广播思维过程
            await self._broadcast(msg)

            # 返回最终结果
            if isinstance(msg, ResultMessage):
                yield {
                    "content": msg.result or "任务完成",
                    "metadata": {"cost": msg.total_cost_usd}
                }
```

## 自定义 Actions

### 注册 Action

```tsx
// 前端
import { useCopilotAction } from "@copilotkit/react-core";

useCopilotAction({
  name: "request_permission",
  description: "请求用户权限确认",
  parameters: [
    { name: "requestId", type: "string" },
    { name: "toolName", type: "string" },
    { name: "description", type: "string" },
    { name: "riskLevel", type: "string" },
  ],
  renderAndWaitForResponse: async ({ args, respond }) => {
    // 显示 UI 并等待用户响应
    const approved = await showPermissionDialog(args);
    respond({ approved });
  },
});
```

### Action 类型

1. **普通 Action** - 执行操作

```tsx
useCopilotAction({
  name: "my_action",
  handler: async ({ args }) => {
    // 执行操作
    return { result: "done" };
  },
});
```

2. **渲染等待响应** - 显示 UI 并等待

```tsx
useCopilotAction({
  name: "confirm_action",
  renderAndWaitForResponse: async ({ args, respond }) => {
    // 显示确认对话框
    // 用户响应后调用 respond()
  },
});
```

## 聊天建议

```tsx
import { useCopilotChatSuggestions } from "@copilotkit/react-core";

useCopilotChatSuggestions({
  instructions: "建议用户询问关于代码、文件操作的问题",
  suggestions: [
    "帮我创建一个新文件",
    "读取当前目录的文件",
    "执行这个命令",
  ],
});
```

## 状态管理

### 读取状态

```tsx
import { useCoagentStateRender } from "@copilotkit/react-core";

useCoagentStateRender({
  name: "claude_code",
  render: ({ state }) => {
    return (
      <div>
        <p>当前状态: {state.status}</p>
        <p>进度: {state.progress}%</p>
      </div>
    );
  },
});
```

### 更新状态

在 Agent 中返回状态更新：

```python
yield {
  "content": "处理中...",
  "state": {
    "status": "processing",
    "progress": 50,
  }
}
```

## 样式定制

### 主题配置

```tsx
<CopilotKit
  theme={{
    colors: {
      primary: "#7C3AED",
      secondary: "#4F46E5",
      background: "#FFFFFF",
      text: "#1F2937",
    },
    fonts: {
      body: "Inter, sans-serif",
      code: "Fira Code, monospace",
    },
  }}
>
  {/* ... */}
</CopilotKit>
```

### 自定义 CSS

```css
/* 覆盖 CopilotKit 默认样式 */
.copilotKitPopup {
  border-radius: 16px;
}

.copilotKitMessage {
  font-size: 14px;
}

.copilotKitInput {
  border-radius: 8px;
}
```

## 调试

### 启用调试模式

```tsx
<CopilotKit
  debug={true}  // 启用调试日志
>
  {/* ... */}
</CopilotKit>
```

### 查看通信内容

```tsx
useEffect(() => {
  const handler = (event) => {
    console.log("CopilotKit Event:", event.detail);
  };

  window.addEventListener("copilotkit:event", handler);
  return () => window.removeEventListener("copilotkit:event", handler);
}, []);
```

## 常见问题

### 1. 连接失败

检查后端 URL 配置：

```tsx
<CopilotKit
  runtimeUrl="http://localhost:8000/copilotkit"  // 确保正确
>
```

### 2. Action 不触发

确保参数类型正确：

```tsx
useCopilotAction({
  name: "my_action",
  parameters: [
    { name: "count", type: "number" },  // 不是 "integer"
    { name: "name", type: "string" },
  ],
});
```

### 3. 样式不生效

确保导入了样式文件：

```tsx
import "@copilotkit/react-ui/styles.css";
```
