# Claude Code Viewer

一个用于可视化 Claude Code 执行过程的 Web 应用，集成 CopilotKit 提供美化的交互界面。

## 功能特点

- 🖥️ **左侧手机框架**: 显示 CopilotKit 美化的交互界面
- 📋 **右侧思维面板**: 显示 Claude Code 完整思维过程
- 🔄 **双向交互**: 用户通过 CopilotKit 界面回复权限请求
- 📝 **系统提示词**: 首次对话前自动加载可配置的系统提示词
- 🎨 **丰富 UI**: 权限卡片、下拉选择器、进度指示器、结果摘要

## 技术栈

### 前端
- React 18
- Vite
- Tailwind CSS
- CopilotKit (React)

### 后端
- Python FastAPI
- Claude Agent SDK (claude-agent-sdk-python)
- CopilotKit SDK (copilotkit)
- SSE (Server-Sent Events)

## 项目结构

```
claude-code-viewer/
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── PhoneFrame.tsx        # 手机框架
│   │   │   ├── ProcessPanel.tsx      # 思维过程面板
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useProcessStream.ts   # SSE 连接
│   │   ├── types/
│   │   │   └── messages.ts           # 类型定义
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Python FastAPI
│   ├── app/
│   │   ├── main.py           # FastAPI 入口 + CopilotKit 集成
│   │   ├── config.py         # 配置管理
│   │   ├── models.py         # 数据模型
│   │   ├── agents/           # CopilotKit Agents
│   │   ├── sdk/              # Claude SDK 封装
│   │   └── api/              # API 端点
│   ├── system_prompt.md      # 系统提示词配置
│   └── requirements.txt
└── docs/                     # 设计文档
    ├── index.md
    ├── architecture.md
    ├── configuration.md
    └── ...
```

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 密钥
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
cp .env.example .env
# 编辑 .env 配置
npm run dev
```

## 配置

### 环境变量

后端 (.env):
```bash
# Claude Code SDK 配置
ANTHROPIC_API_KEY=your_api_key
ANTHROPIC_AUTH_TOKEN=your_auth_token
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# CopilotKit LLM 配置
COPILOTKIT_LLM_API_KEY=your_api_key
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5

# 系统提示词配置
SYSTEM_PROMPT_PATH=./system_prompt.md
```

前端 (.env):
```bash
VITE_API_URL=http://localhost:8000
```

## 文档

详细设计文档请参阅 [docs/index.md](docs/index.md)

## 架构

```
┌────────────────────────────────────────────────────────────────┐
│                         用户界面层                              │
│  ┌─────────────────────┐   ┌───────────────────────────────┐  │
│  │   PhoneFrame        │   │   ProcessPanel                │  │
│  │   (CopilotKit UI)   │   │   (思维过程 SSE 流)            │  │
│  └─────────────────────┘   └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       后端服务层                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  FastAPI + CopilotKitRemoteEndpoint                     │  │
│  │  └── ClaudeCodeAgent                                     │  │
│  │       ├── 系统提示词预加载                                │  │
│  │       ├── 消息转发到 Claude SDK                          │  │
│  │       └── 思维过程广播到 SSE                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                       Claude SDK 层                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ClaudeSDKClient (claude-agent-sdk-python)              │  │
│  │  - 启动 Claude Code CLI                                  │  │
│  │  - 发送用户消息                                          │  │
│  │  - 接收 Claude 响应流                                    │  │
│  │  - 权限请求回调                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    Claude Code CLI (本地)                      │
└────────────────────────────────────────────────────────────────┘
```

## License

MIT
