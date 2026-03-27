# Claude Code Viewer

一个用于可视化 Claude Code 执行过程的 Web 应用。

## 功能特点

- 🖥️ **左侧手机框架**: 显示 CopilotKit 美化的交互界面
- 📋 **右侧消息面板**: 显示 Claude Code 原始消息流
- 🔄 **双向交互**: 用户可以通过 CopilotKit 界面回复 Claude Code 的权限请求

## 技术栈

### 前端
- React 18
- Vite
- Tailwind CSS
- CopilotKit

### 后端
- Python FastAPI
- WebSocket
- GLM-5 (本地模型 API)

## 项目结构

```
claude-code-viewer/
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── PhoneFrame.tsx        # 手机框架
│   │   │   ├── CopilotChat.tsx       # 美化交互区
│   │   │   ├── ProcessPanel.tsx      # 原始消息面板
│   │   │   ├── PermissionDialog.tsx  # 权限确认组件
│   │   │   ├── SelectionCard.tsx     # 选择组件
│   │   │   └── SummaryCard.tsx       # 总结卡片
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts       # WebSocket 连接
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Python FastAPI
│   ├── app/
│   │   ├── main.py           # FastAPI 入口
│   │   ├── agents.py         # CopilotKitAgent + ClaudeCodeAgent
│   │   ├── ws.py             # WebSocket 处理
│   │   └── models.py         # 数据模型
│   └── requirements.txt
└── README.md
```

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 配置

### 环境变量

前端:
```
VITE_WS_URL=ws://localhost:8000/ws
```

后端:
```
GLM_API_URL=your_glm_api_url
GLM_API_KEY=your_api_key
```

## 开发

```bash
# 启动开发服务器
cd frontend && npm run dev

# 启动后端
cd backend && uvicorn app.main:app --reload
```

## License

MIT
