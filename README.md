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

### 环境要求

- **Python**: 3.10 - 3.12 (不支持 3.13+)
- **Node.js**: 18+
- **Claude Code CLI**: 已安装并配置好

### 第一步：克隆项目

```bash
git clone <repository-url>
cd claude-code-viewer
```

### 第二步：启动后端

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境
python -m venv venv

# 3. 激活虚拟环境
# Linux/Mac:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 复制环境变量模板
cp .env.example .env

# 6. 编辑 .env 文件，配置 API 密钥
# 必须配置的变量：
# - ANTHROPIC_API_KEY
# - ANTHROPIC_AUTH_TOKEN
# - ANTHROPIC_BASE_URL
# - ANTHROPIC_MODEL

# 7. 启动后端服务
uvicorn app.main:app --reload --port 8000
```

**验证后端启动成功：**

看到以下输出表示启动成功：
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxxx] using WatchFiles
🚀 Claude Code Viewer 启动中...
   工作目录: .
   模型: claude-sonnet-4-5
   系统提示词已加载 (xxx 字符)
   CopilotKit 端点已注册: /copilotkit
```

访问 http://localhost:8000/health 应返回 `{"status": "ok"}`

### 第三步：启动前端

**新开一个终端窗口：**

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 复制环境变量模板
cp .env.example .env

# 4. 启动开发服务器
npm run dev
```

**验证前端启动成功：**

看到以下输出表示启动成功：
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
```

### 第四步：访问应用

打开浏览器访问 http://localhost:3000

## 配置

### 后端环境变量 (.env)

```bash
# ============ Claude Code SDK 配置 (必填) ============
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_AUTH_TOKEN=your_auth_token_here
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-4-5

# Claude Code CLI 路径 (可选，默认使用系统 PATH 中的 claude)
# CLAUDE_CODE_CLI_PATH=/usr/local/bin/claude

# ============ CopilotKit LLM 配置 (可选) ============
# 如果不配置，CopilotKit 将使用默认设置
COPILOTKIT_LLM_API_KEY=your_api_key_here
COPILOTKIT_LLM_BASE_URL=https://api.anthropic.com
COPILOTKIT_LLM_MODEL=claude-sonnet-4-5

# ============ 系统提示词配置 ============
SYSTEM_PROMPT_PATH=./system_prompt.md

# ============ 服务配置 ============
HOST=0.0.0.0
PORT=8000
DEBUG=true
```

### 前端环境变量 (.env)

```bash
# 后端 API 地址
VITE_API_URL=http://localhost:8000
```

## 常见问题

### 后端启动失败

**问题: `ModuleNotFoundError: No module named 'langgraph'`**

解决: 确保安装了所有依赖
```bash
pip install -r requirements.txt
```

**问题: Python 版本不兼容**

解决: CopilotKit 要求 Python 3.10-3.12，不支持 3.13+
```bash
# 使用 pyenv 切换 Python 版本
pyenv install 3.12
pyenv local 3.12
```

**问题: `ValidationError` 配置错误**

解决: 确保 `.env` 文件中配置了所有必填变量
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`

### 前端启动失败

**问题: `npm install` 失败**

解决: 清除缓存后重试
```bash
rm -rf node_modules package-lock.json
npm install
```

**问题: 页面空白或连接失败**

解决:
1. 确认后端已启动 (访问 http://localhost:8000/health)
2. 检查前端 `.env` 中的 `VITE_API_URL` 是否正确
3. 检查浏览器控制台是否有跨域错误

### Claude Code CLI 相关

**问题: Claude Code CLI 未找到**

解决: 确保 Claude Code CLI 已安装并在 PATH 中
```bash
# 检查是否安装
which claude

# 如果未安装，按照官方文档安装
```

## 开发命令

### 后端

```bash
# 启动开发服务器 (热重载)
uvicorn app.main:app --reload --port 8000

# 启动生产服务器
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 查看 API 文档
# 访问 http://localhost:8000/docs
```

### 前端

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview

# 代码检查
npm run lint
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