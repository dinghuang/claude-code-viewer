# 前端设计

## 概述

前端基于 React 18 + Vite + Tailwind CSS 构建，使用 CopilotKit v1.54.1 提供 AI 聊天界面。采用 Indigo 主题设计，支持 Markdown 卡片化渲染、权限交互卡片、以及设置浮窗。

## 模块结构

```
frontend/
├── server/
│   └── copilotkit-runtime.ts      # CopilotKit Runtime 服务 (Port 4000)
│
├── src/
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # CopilotKit Provider + 双栏布局
│   ├── index.css                   # Tailwind + CopilotKit 主题覆盖 + 卡片样式
│   │
│   ├── components/
│   │   ├── PhoneFrame.tsx          # 手机框架 (24h 实时时钟)
│   │   ├── ProcessPanel.tsx        # 思维过程面板 (SSE)
│   │   ├── SystemPromptPanel.tsx   # 设置浮窗 (提示词 + 权限模式)
│   │   ├── PermissionDialog.tsx    # 权限审批卡片 (LangGraph interrupt)
│   │   ├── CopilotChat.tsx         # CopilotKit 聊天组件
│   │   ├── SelectionCard.tsx       # 选择器卡片
│   │   └── SummaryCard.tsx         # 结果摘要
│   │
│   ├── hooks/
│   │   ├── useProcessStream.ts     # SSE 思维过程流 Hook
│   │   └── useWebSocket.ts         # WebSocket Hook (预留)
│   │
│   └── types/
│       └── messages.ts             # ProcessMessage 类型定义
```

## UI 设计系统

### 主题色

采用 **Indigo** 为主色调，覆盖 CopilotKit 默认的黑色主题：

```css
:root {
  --copilot-kit-primary-color: #6366f1;       /* Indigo-500 */
  --copilot-kit-contrast-color: #ffffff;
  --copilot-kit-secondary-contrast-color: #1e293b;  /* Slate-800 */
  --copilot-kit-separator-color: #e2e8f0;     /* Slate-200 */
}
```

### 用户消息气泡

蓝紫渐变 + 聊天尖角 + 紫色投影：

```css
.copilotKitMessage.copilotKitUserMessage {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border-radius: 18px 18px 4px 18px;     /* 右下角尖角 — 聊天感 */
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}
```

### 助手消息

透明背景 + `slate-700` 文字，Markdown 内容自动渲染为富卡片。

### 输入框

浅灰底 + 聚焦时 Indigo 光晕：

```css
.copilotKitInput:focus-within {
  border-color: #a5b4fc;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}
```

## Markdown 卡片化渲染

CopilotKit 默认不提供表格/代码块/引用样式。通过 CSS 覆盖 `.copilotKitMarkdown` 实现卡片化：

### 表格卡片

```css
.copilotKitMarkdown table {
  border-collapse: separate;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border: 1px solid #e5e7eb;
}

.copilotKitMarkdown thead {
  background: linear-gradient(135deg, #f8fafc, #f1f5f9);
}

.copilotKitMarkdown tbody tr:hover td {
  background-color: #f8fafc;
}
```

效果：圆角卡片 + 渐变表头 + 斑马纹 + hover 高亮

### 代码块卡片

```css
.copilotKitMarkdown pre {
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}
```

### 引用块卡片

```css
.copilotKitMarkdown blockquote {
  border-left: 3px solid #3b82f6;
  background: #f0f7ff;
  border-radius: 0 8px 8px 0;
}
```

## 权限交互卡片

当 `permission_mode="default"` 且 Claude Code CLI 拒绝了工具操作时，LangGraph `permission_check_node` 调用 `interrupt()` 暂停图，前端通过 `useLangGraphInterrupt` 渲染权限卡片。

### 前端 Hook

```tsx
// App.tsx
useLangGraphInterrupt({
  enabled: ({ eventValue }) => eventValue?.type === "permission_request",
  render: ({ event, resolve }) => (
    <PermissionCard
      denials={event.value.denials}
      message={event.value.message}
      onRespond={(approved) => resolve(JSON.stringify({ approved }))}
    />
  ),
});
```

### PermissionCard 组件

`frontend/src/components/PermissionDialog.tsx`

渲染内容：
- 橙色渐变头部 + 警告图标
- 被拒绝的工具列表，每项显示：
  - 风险等级标签 (高/中/低，对应红/黄/绿色)
  - 工具名称
  - 参数 JSON 预览
- 操作按钮："跳过" / "允许并重试"

```
┌──────────────────────────────────────┐
│ ⚠️ Claude 请求执行 1 个被拒绝的操作    │  ← 橙色渐变头部
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🔴 高风险   Write                │ │  ← 工具卡片
│ │ file_path: /tmp/test.txt        │ │
│ │ content: hello                   │ │
│ └──────────────────────────────────┘ │
│                                      │
│  [跳过]          [允许并重试]         │  ← 操作按钮
└──────────────────────────────────────┘
```

### 权限流程

```
用户发消息 → execute (permission_mode=default)
  → Claude 调 Write → CLI 拒绝 → permission_denials 捕获
  → permission_check_node → interrupt()
  → CopilotChat 显示 PermissionCard
  → 用户点"允许并重试" → 图恢复 → execute 以 bypassPermissions 重跑
  → 用户点"跳过" → collect → 显示 Claude 的文字回复
```

## 设置浮窗 (SettingsPanel)

`frontend/src/components/SystemPromptPanel.tsx`

### 入口

左下角固定的齿轮按钮 (`fixed bottom-4 left-4`)，点击打开设置 Modal。

### Modal 内容

两个配置区域：

**1. 权限模式 (radio 选择)**

| 选项 | 值 | 说明 |
|------|-----|------|
| 跳过所有权限 | `bypassPermissions` | 自动批准所有操作 (默认) |
| 自动批准编辑 | `acceptEdits` | 文件编辑自动批准，其他需确认 |
| 默认模式 | `default` | 按 Claude Code 默认权限策略 |
| 计划模式 | `plan` | 先展示计划，确认后执行 |

选中高亮为蓝色边框 + 蓝色背景。

**2. 系统提示词 (textarea)**

- 等宽字体 (`font-mono`)，300px 高度
- 右上角"恢复默认"链接
- 默认内容内置在前端 (`DEFAULT_PROMPT` 常量)

### 保存行为

点击"保存"同时调用两个 REST API：

```
POST /api/system-prompt   {"prompt": "..."}
POST /api/permission-mode {"mode": "default"}
```

后端存储在内存中，下次 Agent 执行时生效。

### 设计规格

```
┌──────────────────────────────────────────┐
│  设置                              [✕]   │  ← 白色头部
├──────────────────────────────────────────┤
│  权限模式                                 │
│  ┌────────────────────────────────────┐  │
│  │ ○ 跳过所有权限                      │  │  ← radio 卡片列表
│  │   自动批准所有操作                   │  │
│  ├────────────────────────────────────┤  │
│  │ ● 默认模式                  (选中)  │  │  ← 蓝色高亮
│  │   按 Claude Code 默认权限策略       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  系统提示词                  [恢复默认]    │
│  ┌────────────────────────────────────┐  │
│  │ # Claude Code Viewer 助手          │  │  ← textarea
│  │ 你是一个 Claude Code 助手...       │  │
│  │ ...                                │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│                    [取消]  [保存]          │  ← 底部按钮
└──────────────────────────────────────────┘
```

## 主布局

```tsx
<CopilotKit runtimeUrl={`${RUNTIME_URL}/copilotkit`} agent="claude_code">
  <SettingsPanel ... />
  <div className="flex h-screen">
    {/* 左侧: shrink-0 手机固定宽度 */}
    <div className="shrink-0"><PhoneFrame><CopilotChatUI /></PhoneFrame></div>
    {/* 右侧: flex-1 占满剩余 */}
    <div className="flex-1"><ProcessPanel /></div>
  </div>
</CopilotKit>
```

`CopilotChatUI` 内部注册了：
- `useCoAgentStateRender` — 监听 Agent 状态
- `useLangGraphInterrupt` — 渲染权限卡片

## 通信协议

| 方向 | 协议 | 端点 |
|------|------|------|
| CopilotChat → Runtime | Single-Route JSON-RPC | `POST http://localhost:4000/copilotkit` |
| ProcessPanel → Backend | SSE | `GET http://localhost:8000/api/process-stream` |
| 设置面板 → Backend | REST | `POST /api/system-prompt`, `POST /api/permission-mode` |

## 启动

```bash
cd frontend
npm install
npm run dev          # 前端 (Port 3000)
npm run dev:runtime  # Runtime (Port 4000)
npm run dev:all      # 同时启动
```
