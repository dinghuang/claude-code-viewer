# Claude Code Viewer

一个用于可视化 Claude Code 执行过程的 Web 应用。采用三服务架构，通过 CopilotKit 提供美化的聊天交互界面，右侧实时展示 Claude Code 的思维过程。

## 功能特点

- **左侧手机框架**: CopilotKit 美化的聊天界面，24 小时实时时钟
- **右侧思维面板**: SSE 实时展示 Claude Code 完整执行过程（思考、工具调用、结果）
- **系统提示词编辑**: 左下角浮窗可实时编辑系统提示词，自动同步到后端
- **真实 Claude Code CLI**: 后端通过 `claude-agent-sdk` 调用真实的 Claude Code CLI
- **响应式布局**: 桌面端双栏（手机固定宽度 + 右侧自适应），移动端 Tab 切换

## 架构

```
Frontend (3000)  →  Runtime (4000)  →  Backend (8000)
React+CopilotKit    Node.js Middleware   Python+LangGraph
Single-Route        协议转换              AG-UI SSE
                                         ↓
                                    Claude Code CLI
```

三服务架构：

| 服务 | 技术栈 | 端口 | 职责 |
|------|--------|------|------|
| **Frontend** | React 18 + Vite + Tailwind CSS + CopilotKit 1.54.1 | 3000 | 聊天 UI、思维过程展示、系统提示词编辑 |
| **Runtime** | Node.js + @copilotkit/runtime 1.54.1 | 4000 | Single-Route ↔ AG-UI 协议转换 |
| **Backend** | Python 3.12 + FastAPI + LangGraph + claude-agent-sdk | 8000 | LangGraph Agent 编排、Claude Code CLI 调用、SSE 广播 |

### 后端 LangGraph 流程

```
用户消息 → prepare (加载系统提示词) → execute (调用 Claude Code CLI) → collect (返回 AI 回复)
                                          │
                                    ├── SSE 广播到 ProcessPanel
                                    └── 最终结果 → CopilotChat
```

## 技术栈

### 前端 (Port 3000)
- React 18 + Vite + Tailwind CSS
- CopilotKit v1.54.1 (`@copilotkit/react-core`, `@copilotkit/react-ui`)

### Runtime 中间层 (Port 4000)
- Node.js + `@copilotkit/runtime` v1.54.1
- `LangGraphHttpAgent` 转发到 Python 后端

### 后端 (Port 8000)
- Python 3.12 + FastAPI
- LangGraph 1.0+ (`ag-ui-langgraph` 0.0.28)
- `claude-agent-sdk` 0.1.51 (调用 Claude Code CLI)
- `copilotkit` 0.1.83
- SSE (`sse-starlette`)

## 项目结构

```
claude-code-viewer/
├── frontend/                         # React 前端 (Port 3000)
│   ├── server/
│   │   └── copilotkit-runtime.ts     # CopilotKit Runtime (Port 4000)
│   ├── src/
│   │   ├── App.tsx                   # CopilotKit Provider + 布局
│   │   ├── components/
│   │   │   ├── PhoneFrame.tsx        # 手机框架 (24h 时钟)
│   │   │   ├── ProcessPanel.tsx      # 思维过程面板 (SSE)
│   │   │   ├── SystemPromptPanel.tsx # 系统提示词浮窗编辑器
│   │   │   ├── PermissionDialog.tsx  # 权限确认卡片
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useProcessStream.ts   # SSE 连接 Hook
│   │   └── types/
│   │       └── messages.ts
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                          # Python 后端 (Port 8000)
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口 + AG-UI + REST API
│   │   ├── config.py                 # Pydantic Settings 配置
│   │   ├── models.py                 # ProcessMessage 模型
│   │   ├── agents/
│   │   │   └── claude_code_agent.py  # LangGraph Agent (prepare/execute/collect)
│   │   ├── sdk/
│   │   │   └── client.py             # Claude SDK options builder
│   │   └── api/
│   │       └── process_stream.py     # SSE 思维过程端点
│   ├── system_prompt.md              # 默认系统提示词 (fallback)
│   ├── requirements.txt
│   └── venv/                         # Python 3.12 虚拟环境
│
└── docs/                             # 设计文档
    ├── index.md
    ├── architecture.md
    ├── runtime.md
    ├── backend.md
    ├── frontend.md
    ├── data-flow.md
    ├── configuration.md
    └── copilotkit-integration.md
```

## 快速开始

### 环境要求

- **Python**: 3.10 - 3.12 (不支持 3.13+，CopilotKit SDK 限制)
- **Node.js**: 18+
- **Claude Code CLI**: 已安装并配置

### 第一步：启动后端

```bash
cd backend

# 创建 Python 3.12 虚拟环境 (推荐用 pyenv)
python3.12 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 密钥

uvicorn app.main:app --reload --port 8000
```

验证：`curl http://localhost:8000/health` → `{"status":"ok"}`

### 第二步：启动 Runtime + 前端

```bash
cd frontend

npm install
cp .env.example .env

# 方式一：分别启动
npm run dev          # 前端 (Port 3000)
npm run dev:runtime  # Runtime (Port 4000)

# 方式二：同时启动
npm run dev:all
```

### 第三步：访问

打开 http://localhost:3000

- 左侧手机框架：输入消息与 Claude Code 对话
- 右侧面板：实时查看 Claude Code 思维过程
- 左下角齿轮：编辑系统提示词

## 配置

### 后端环境变量 (backend/.env)

```bash
# ============ Claude Code SDK 配置 (必填) ============
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_AUTH_TOKEN=your_auth_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# ============ 系统提示词 (可选，前端编辑器优先) ============
SYSTEM_PROMPT_PATH=./system_prompt.md

# ============ 服务配置 ============
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

### Runtime 环境变量

```bash
AGENT_URL=http://localhost:8000     # Python 后端地址
RUNTIME_PORT=4000                   # Runtime 端口
```

### 前端环境变量 (frontend/.env)

```bash
VITE_API_URL=http://localhost:8000                    # SSE 流 + 系统提示词 API
VITE_COPILOTKIT_RUNTIME_URL=http://localhost:4000     # CopilotKit Runtime
```

## API 端点

### Backend (Port 8000)

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /` | AG-UI | LangGraph Agent 执行 (由 Runtime 调用) |
| `GET /health` | REST | 健康检查 |
| `GET /api/process-stream` | SSE | 思维过程实时流 |
| `GET /api/system-prompt` | REST | 获取当前系统提示词 |
| `POST /api/system-prompt` | REST | 更新系统提示词 |

### Runtime (Port 4000)

| 端点 | 方法 | 说明 |
|------|------|------|
| `POST /copilotkit` | Single-Route | CopilotKit 统一端点 (method: info/agent/run/agent/stop) |
| `GET /health` | REST | 健康检查 |

## 常见问题

### Python 版本不兼容

CopilotKit Python SDK 要求 Python 3.10-3.12，不支持 3.13+：

```bash
pyenv install 3.12
cd backend && pyenv local 3.12
python -m venv venv
```

### 前端连接失败

1. 确认三个服务都已启动
2. 检查 `frontend/.env` 中的 URL 配置
3. Runtime 必须启动 (`npm run dev:runtime`)

### Claude Code CLI 未响应

确保 Claude Code CLI 已安装且 `.env` 中的 API 密钥正确：

```bash
which claude
```

## 文档

详细设计文档请参阅 [docs/index.md](docs/index.md)

## License

MIT
