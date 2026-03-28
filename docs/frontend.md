# 前端设计

## 概述

前端基于 React 18 + Vite + Tailwind CSS 构建，使用 CopilotKit v1.54.1 提供 AI 聊天界面。前端通过 Single-Route JSON-RPC 协议与 CopilotKit Runtime (Node.js) 通信，同时通过独立 SSE 连接接收思维过程数据。

## 模块结构

```
frontend/
├── server/
│   └── copilotkit-runtime.ts      # CopilotKit Runtime 服务 (Port 4000)
│
├── src/
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # CopilotKit Provider + 双栏布局
│   ├── index.css                   # Tailwind CSS 入口
│   │
│   ├── components/
│   │   ├── PhoneFrame.tsx          # 手机框架容器
│   │   ├── ProcessPanel.tsx        # 思维过程面板 (SSE)
│   │   ├── CopilotChat.tsx         # CopilotKit 聊天组件
│   │   ├── PermissionDialog.tsx    # 权限确认对话框
│   │   ├── SelectionCard.tsx       # 选择器卡片
│   │   └── SummaryCard.tsx         # 结果摘要
│   │
│   ├── hooks/
│   │   ├── useProcessStream.ts     # SSE 思维过程流 Hook
│   │   └── useWebSocket.ts         # WebSocket Hook (预留)
│   │
│   └── types/
│       └── messages.ts             # ProcessMessage 类型定义
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── .env.example
└── .env
```

## 核心组件

### 1. 主布局 (App.tsx)

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const RUNTIME_URL = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000";

export default function App() {
  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}  // 指向 Runtime (非 Backend)
      agent="claude_code"
    >
      <div className="flex h-screen bg-gray-100">
        {/* 左侧：手机框架内的 CopilotKit Chat */}
        <div className="w-1/2 flex items-center justify-center">
          <PhoneFrame>
            <CopilotChatUI />
          </PhoneFrame>
        </div>
        {/* 右侧：思维过程面板 */}
        <div className="w-1/2 border-l">
          <ProcessPanel />
        </div>
      </div>
    </CopilotKit>
  );
}
```

**关键配置：**
- `runtimeUrl` 指向 **Node.js Runtime** (port 4000)，而非 Python 后端
- `agent="claude_code"` 对应后端注册的 LangGraphAgent 名称

### 2. 通信协议

CopilotKit v1.54.1 前端内部使用 **Single-Route** 传输：

```
CopilotKit React → POST http://localhost:4000/copilotkit
  Body: {"method":"agent/run","params":{"agentId":"claude_code"},"body":{...}}
```

这是由 `@copilotkit/react-core` 包装器自动设置的 (`useSingleEndpoint: true`)。

### 3. 思维过程面板 (ProcessPanel.tsx)

通过独立 SSE 连接到 Python 后端获取思维过程数据：

```
EventSource → GET http://localhost:8000/api/process-stream
```

这条连接直接到 Python 后端 (不经过 Runtime)，因为思维过程是独立于 CopilotKit 协议的数据通道。

### 4. 思维过程流 Hook (useProcessStream.ts)

```typescript
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

  return { messages, isConnected, clearMessages };
}
```

## 类型定义

```typescript
// frontend/src/types/messages.ts

export type ProcessMessageType =
  | "thinking" | "tool_use" | "tool_result"
  | "text" | "permission" | "result" | "error";

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
    "@copilotkit/react-core": "^1.54.1",
    "@copilotkit/react-ui": "^1.54.1",
    "@copilotkit/runtime": "^1.54.1",
    "@ag-ui/langgraph": "^0.0.25",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "reflect-metadata": "^0.2.2",
    "tsx": "^4.21.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.2"
  }
}
```

## Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',  // SSE 流直接到 Python 后端
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
```

**注意：** `/copilotkit` 不在 Vite proxy 中，因为前端直接通过 `RUNTIME_URL` 访问 Runtime。

## 启动

```bash
cd frontend

npm install

# 仅启动前端
npm run dev

# 启动 Runtime
npm run dev:runtime

# 同时启动前端 + Runtime
npm run dev:all
```
