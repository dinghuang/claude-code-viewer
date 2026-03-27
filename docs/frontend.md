# 前端设计

## 模块结构

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # 主布局
│   │
│   ├── components/
│   │   ├── layout/                # 布局组件
│   │   │   ├── PhoneFrame.tsx     # 手机框架
│   │   │   └── SplitPane.tsx      # 分屏布局
│   │   │
│   │   ├── chat/                  # CopilotKit 聊天组件
│   │   │   ├── CopilotChat.tsx    # 主聊天组件
│   │   │   ├── ChatMessage.tsx    # 消息渲染
│   │   │   └── ChatInput.tsx      # 输入框
│   │   │
│   │   ├── interaction/           # 交互组件
│   │   │   ├── PermissionCard.tsx # 权限确认卡片
│   │   │   ├── SelectionCard.tsx  # 下拉选择器
│   │   │   ├── ProgressCard.tsx   # 进度指示器
│   │   │   └── SummaryCard.tsx    # 结果摘要卡片
│   │   │
│   │   └── process/               # 思维过程面板
│   │       ├── ProcessPanel.tsx   # 右侧面板
│   │       ├── ThinkingBlock.tsx  # 思考块
│   │       ├── ToolUseBlock.tsx   # 工具调用
│   │       └── ToolResultBlock.tsx # 工具结果
│   │
│   ├── hooks/
│   │   ├── useProcessStream.ts    # 思维过程流
│   │   └── useCopilotActions.ts   # CopilotKit Actions
│   │
│   ├── lib/
│   │   ├── copilotkit.ts          # CopilotKit 配置
│   │   └── api.ts                 # API 客户端
│   │
│   └── types/
│       └── messages.ts            # 消息类型定义
│
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── .env
```

## 核心组件

### 1. 主布局 (App.tsx)

```tsx
import { CopilotKit } from "@copilotkit/react";
import { PhoneFrame } from "./components/layout/PhoneFrame";
import { ProcessPanel } from "./components/process/ProcessPanel";
import { CopilotChat } from "./components/chat/CopilotChat";
import { copilotKitConfig } from "./lib/copilotkit";

export default function App() {
  return (
    <CopilotKit
      publicApiKey={import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY}
      agent="claude_code"
      runtimeUrl={import.meta.env.VITE_API_URL + "/copilotkit"}
      {...copilotKitConfig}
    >
      <div className="flex h-screen bg-gray-100">
        {/* 左侧：手机框架内的 CopilotKit UI */}
        <div className="w-1/2 flex items-center justify-center p-4">
          <PhoneFrame>
            <CopilotChat />
          </PhoneFrame>
        </div>

        {/* 右侧：思维过程面板 */}
        <div className="w-1/2 border-l border-gray-200">
          <ProcessPanel />
        </div>
      </div>
    </CopilotKit>
  );
}
```

### 2. 手机框架 (components/layout/PhoneFrame.tsx)

```tsx
import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative">
      {/* 手机外壳 */}
      <div className="w-[375px] h-[812px] bg-gray-900 rounded-[50px] p-3 shadow-2xl">
        {/* 屏幕 */}
        <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative">
          {/* 刘海 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10" />

          {/* 内容区域 */}
          <div className="h-full pt-8 overflow-hidden">
            {children}
          </div>

          {/* 底部指示条 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
```

### 3. CopilotKit 聊天 (components/chat/CopilotChat.tsx)

```tsx
import {
  CopilotPopup,
  useCopilotChatSuggestions,
} from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { PermissionCard } from "../interaction/PermissionCard";
import { SelectionCard } from "../interaction/SelectionCard";

export function CopilotChat() {
  // 添加聊天建议
  useCopilotChatSuggestions({
    instructions: "建议用户询问关于代码、文件操作或执行命令的问题",
  });

  return (
    <div className="h-full flex flex-col">
      {/* 交互组件区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PermissionCard />
        <SelectionCard />
      </div>

      {/* CopilotKit 聊天弹窗 */}
      <CopilotPopup
        instructions="你是一个 Claude Code 助手，帮助用户执行代码任务。"
        labels={{
          title: "Claude Code",
          initial: "有什么我可以帮你的？",
          placeholder: "输入你的问题...",
        }}
        defaultOpen={true}
      />
    </div>
  );
}
```

### 4. 权限确认卡片 (components/interaction/PermissionCard.tsx)

```tsx
import { useCopilotAction } from "@copilotkit/react-core";
import { useState } from "react";

interface PermissionRequest {
  requestId: string;
  toolName: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

export function PermissionCard() {
  const [request, setRequest] = useState<PermissionRequest | null>(null);

  useCopilotAction({
    name: "request_permission",
    description: "请求用户权限确认",
    parameters: [
      { name: "requestId", type: "string" },
      { name: "toolName", type: "string" },
      { name: "description", type: "string" },
      { name: "riskLevel", type: "string" },
    ],
    renderAndWaitForResponse: ({ args, respond }) => {
      setRequest({
        requestId: args.requestId,
        toolName: args.toolName,
        description: args.description,
        riskLevel: args.riskLevel,
      });

      return new Promise((resolve) => {
        (window as any)._permissionResolver = (approved: boolean) => {
          respond({ approved });
          setRequest(null);
          resolve(null);
        };
      });
    },
  });

  if (!request) return null;

  const riskColors = {
    low: "bg-green-50 border-green-200",
    medium: "bg-yellow-50 border-yellow-200",
    high: "bg-red-50 border-red-200",
  };

  const riskLabels = {
    low: "🟢 低风险",
    medium: "🟡 中风险",
    high: "🔴 高风险",
  };

  return (
    <div className={`rounded-lg border p-4 ${riskColors[request.riskLevel]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium">{riskLabels[request.riskLevel]}</span>
        <span className="text-xs text-gray-500">权限请求</span>
      </div>

      <h3 className="font-semibold mb-2">执行工具: {request.toolName}</h3>
      <p className="text-sm text-gray-600 mb-4">{request.description}</p>

      <div className="flex gap-2">
        <button
          onClick={() => (window as any)._permissionResolver?.(true)}
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
        >
          ✅ 允许
        </button>
        <button
          onClick={() => (window as any)._permissionResolver?.(false)}
          className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300"
        >
          ❌ 拒绝
        </button>
      </div>
    </div>
  );
}
```

### 5. 下拉选择器 (components/interaction/SelectionCard.tsx)

```tsx
import { useCopilotAction } from "@copilotkit/react-core";
import { useState } from "react";

interface SelectionRequest {
  requestId: string;
  title: string;
  options: string[];
  multiSelect: boolean;
}

export function SelectionCard() {
  const [request, setRequest] = useState<SelectionRequest | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  useCopilotAction({
    name: "request_selection",
    description: "请求用户选择选项",
    parameters: [
      { name: "requestId", type: "string" },
      { name: "title", type: "string" },
      { name: "options", type: "array" },
      { name: "multiSelect", type: "boolean" },
    ],
    renderAndWaitForResponse: ({ args, respond }) => {
      setRequest({
        requestId: args.requestId,
        title: args.title,
        options: args.options,
        multiSelect: args.multiSelect,
      });
      setSelected([]);

      return new Promise((resolve) => {
        (window as any)._selectionResolver = (values: string[]) => {
          respond({ selected: values });
          setRequest(null);
          resolve(null);
        };
      });
    },
  });

  if (!request) return null;

  const toggleOption = (option: string) => {
    if (request.multiSelect) {
      setSelected((prev) =>
        prev.includes(option)
          ? prev.filter((o) => o !== option)
          : [...prev, option]
      );
    } else {
      setSelected([option]);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4 shadow-sm">
      <h3 className="font-semibold mb-3">{request.title}</h3>

      <div className="space-y-2 mb-4">
        {request.options.map((option) => (
          <label
            key={option}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              selected.includes(option)
                ? "bg-blue-50 border-blue-300"
                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
            }`}
          >
            <input
              type={request.multiSelect ? "checkbox" : "radio"}
              checked={selected.includes(option)}
              onChange={() => toggleOption(option)}
              className="w-4 h-4"
            />
            <span className="text-sm">{option}</span>
          </label>
        ))}
      </div>

      <button
        onClick={() => (window as any)._selectionResolver?.(selected)}
        disabled={selected.length === 0}
        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        确认选择
      </button>
    </div>
  );
}
```

### 6. 思维过程面板 (components/process/ProcessPanel.tsx)

```tsx
import { useProcessStream } from "../../hooks/useProcessStream";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolUseBlock } from "./ToolUseBlock";
import { ToolResultBlock } from "./ToolResultBlock";
import { SummaryCard } from "../interaction/SummaryCard";

export function ProcessPanel() {
  const { messages, isConnected, clearMessages } = useProcessStream();

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <h2 className="font-medium">思维过程</h2>
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <button
          onClick={clearMessages}
          className="text-xs text-gray-400 hover:text-white"
        >
          清空
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.type === "text" && <ThinkingBlock content={msg.content} />}
            {msg.type === "tool_use" && (
              <ToolUseBlock toolName={msg.tool_name} input={msg.tool_input} />
            )}
            {msg.type === "tool_result" && (
              <ToolResultBlock result={msg.tool_result} />
            )}
            {msg.type === "result" && (
              <SummaryCard
                data={{
                  title: "任务完成",
                  content: msg.content,
                  actions: msg.actions || [],
                  cost: msg.cost,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 7. 思维过程流 Hook (hooks/useProcessStream.ts)

```tsx
import { useEffect, useState, useCallback } from "react";
import type { ProcessMessage } from "../types/messages";

export function useProcessStream() {
  const [messages, setMessages] = useState<ProcessMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/process-stream`
    );

    eventSource.onopen = () => setIsConnected(true);
    eventSource.onerror = () => setIsConnected(false);

    eventSource.onmessage = (event) => {
      const msg: ProcessMessage = JSON.parse(event.data);
      setMessages((prev) => [...prev, msg]);
    };

    return () => eventSource.close();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isConnected, clearMessages };
}
```

## 类型定义

```typescript
// frontend/src/types/messages.ts

export type ProcessMessageType =
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "text"
  | "permission"
  | "result"
  | "error";

export interface ProcessMessage {
  id: string;
  type: ProcessMessageType;
  content: string;
  timestamp: number;

  tool_name?: string;
  tool_input?: Record<string, any>;
  tool_result?: any;

  risk_level?: "low" | "medium" | "high";

  actions?: string[];
  cost?: number;
}
```

## 依赖列表

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@copilotkit/react-core": "^1.0.0",
    "@copilotkit/react-ui": "^1.0.0",
    "@copilotkit/runtime-client-gql": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```
