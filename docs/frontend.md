# 前端设计

## 概述

前端基于 React 18 + Vite + Tailwind CSS 构建，使用 CopilotKit v1.54.1 提供 AI 聊天界面。采用 Indigo 主题设计，支持 Markdown 卡片化渲染、权限交互卡片、以及左右分栏设置面板。通过稳定的 `threadId` 实现 session 复用。

## 模块结构

```
frontend/
├── server/
│   └── copilotkit-runtime.ts      # CopilotKit Runtime 服务 (Port 4000)
│
├── src/
│   ├── main.tsx                    # React 入口
│   ├── App.tsx                     # CopilotKit Provider + threadId + 数据初始化
│   ├── index.css                   # Tailwind + CopilotKit 主题覆盖 + 卡片样式
│   │
│   ├── components/
│   │   ├── PhoneFrame.tsx          # iPhone 框架 (24h 实时时钟)
│   │   ├── ProcessPanel.tsx        # 思维过程面板 (SSE)
│   │   ├── SystemPromptPanel.tsx   # 设置面板 (左右分栏 1200px)
│   │   └── PermissionDialog.tsx    # 权限审批卡片 (LangGraph interrupt)
│   │
│   ├── hooks/
│   │   └── useProcessStream.ts     # SSE 思维过程流 Hook
│   │
│   └── types/
│       └── messages.ts             # ProcessMessage 类型定义
```

## Session 复用

### threadId 机制

页面加载时生成一个稳定的 `SESSION_THREAD_ID`：

```typescript
const SESSION_THREAD_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

<CopilotKit runtimeUrl="..." agent="claude_code" threadId={SESSION_THREAD_ID}>
```

- 同一页面会话内所有消息共享 `threadId`，LangGraph 维护对话状态
- 后端 `claude_session_id` 随 LangGraph State 持久化，实现 Claude Code session 复用
- 刷新页面生成新 `threadId`，自然创建全新 session

## 数据初始化

### 页面加载流程

```typescript
useEffect(() => {
  // 1. 从后端文件 API 获取用户信息和系统提示词
  fetch('/api/user-info')    → setUserInfo(info), setDefaultUserInfo(info)
  fetch('/api/system-prompt') → setSystemPrompt(prompt), setDefaultSystemPrompt(prompt)

  // 2. 拼接后发送给后端
  const combined = [info, prompt].join("\n\n---\n\n")
  POST /api/system-prompt  → { prompt: combined }
  POST /api/permission-mode → { mode: "bypassPermissions" }
}, [])
```

- `defaultUserInfo` / `defaultSystemPrompt`：来自后端文件，用于设置面板"恢复默认"按钮
- `userInfo` / `systemPrompt`：当前编辑值，保存时仅做前端缓存
- 刷新页面重置为文件内容

## UI 设计系统

### 主题色

采用 **Indigo** 为主色调：

```css
:root {
  --copilot-kit-primary-color: #6366f1;
  --copilot-kit-contrast-color: #ffffff;
  --copilot-kit-secondary-contrast-color: #1e293b;
  --copilot-kit-separator-color: #e2e8f0;
}
```

### 用户消息气泡

蓝紫渐变 + 聊天尖角 + 紫色投影：

```css
.copilotKitMessage.copilotKitUserMessage {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  border-radius: 18px 18px 4px 18px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}
```

### Markdown 卡片化渲染

- **表格卡片**：圆角卡片 + 渐变表头 + 斑马纹 + hover 高亮
- **代码块卡片**：圆角边框 + 柔和阴影
- **引用块卡片**：蓝色左边线 + 浅蓝背景

## 设置面板 (SettingsPanel)

### 入口

左下角固定的齿轮按钮 (`fixed bottom-4 left-4`)，点击打开设置 Modal。

### 左右分栏布局

Modal 宽度 `1200px`，高度 `85vh` 固定：

```
┌──────────────────────────────────────────────────┬─────────────────────┐
│  设置                                      [✕]   │                     │
├──────────────────────────────────────────────────┤  权限设置            │
│                                                  │                     │
│  用户信息                          [恢复默认]     │  ┌─────────────────┐│
│  ┌──────────────────────────────────────────┐   │  │ ○ 跳过所有权限   ││
│  │ # 用户画像                                │   │  │   自动批准所有... ││
│  │ ## 客户基本信息                            │   │  ├─────────────────┤│
│  │ - 姓名: 王先生                            │   │  │ ● 默认模式 (选中) ││
│  │ - 年龄: 35岁                              │   │  │   按Claude Code...││
│  │ ...                                       │   │  ├─────────────────┤│
│  └──────────────────────────────────────────┘   │  │ ○ 自动批准编辑   ││
│                                                  │  │   文件编辑自动...  ││
│  系统提示词                        [恢复默认]     │  ├─────────────────┤│
│  ┌──────────────────────────────────────────┐   │  │ ○ 计划模式       ││
│  │ # AI智能投顾                              │   │  │   先展示计划...   ││
│  │ 你是一个专业的智能投资研究助手...            │   │  └─────────────────┘│
│  │ ...                                       │   │                     │
│  └──────────────────────────────────────────┘   │                     │
├──────────────────────────────────────────────────┴─────────────────────┤
│                                           [取消]  [保存]               │
└────────────────────────────────────────────────────────────────────────┘
```

### 保存行为

点击"保存"时：
1. 拼接 `用户信息 + "---" + 系统提示词` 为完整提示词
2. POST `/api/system-prompt` (拼接后的内容)
3. POST `/api/permission-mode`
4. 更新前端 state 缓存（不修改后端文件）
5. 刷新页面 → 重新从文件 API 读取，重置为文件内容

### 权限模式

| 选项 | 值 | 说明 |
|------|-----|------|
| 跳过所有权限 | `bypassPermissions` | 自动批准所有操作 (默认) |
| 自动批准编辑 | `acceptEdits` | 文件编辑自动批准，其他需确认 |
| 默认模式 | `default` | 按 Claude Code 默认权限策略 |
| 计划模式 | `plan` | 先展示计划，确认后执行 |

## 权限交互卡片

当 `permission_mode="default"` 且工具被拒时，通过 `useLangGraphInterrupt` 渲染权限卡片：

```tsx
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

```
┌──────────────────────────────────────┐
│ ⚠️ Claude 请求执行 1 个被拒绝的操作    │  ← 橙色渐变头部
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🔴 高风险   Write                │ │  ← 工具卡片 + 风险标签
│ │ file_path: /tmp/test.txt        │ │
│ │ content: hello                   │ │
│ └──────────────────────────────────┘ │
│                                      │
│  [跳过]          [允许并重试]         │
└──────────────────────────────────────┘
```

## 主布局

```tsx
<CopilotKit runtimeUrl="..." agent="claude_code" threadId={SESSION_THREAD_ID}>
  <SettingsPanel userInfo={...} systemPrompt={...} permissionMode={...} ... />
  <div className="flex h-screen">
    {/* 左侧: shrink-0 手机固定宽度 */}
    <div className="shrink-0"><PhoneFrame><CopilotChatUI /></PhoneFrame></div>
    {/* 右侧: flex-1 占满剩余 */}
    <div className="flex-1"><ProcessPanel /></div>
  </div>
</CopilotKit>
```

## 通信协议

| 方向 | 协议 | 端点 |
|------|------|------|
| CopilotChat → Runtime | Single-Route JSON-RPC | `POST localhost:4000/copilotkit` |
| ProcessPanel → Backend | SSE | `GET localhost:8000/api/process-stream` |
| 设置面板 → Backend | REST | `POST /api/system-prompt`, `POST /api/permission-mode` |
| 初始化 → Backend | REST | `GET /api/user-info`, `GET /api/system-prompt` |

## 启动

```bash
cd frontend
npm install
npm run dev          # 前端 (Port 3000)
npm run dev:runtime  # Runtime (Port 4000)
npm run dev:all      # 同时启动
```
