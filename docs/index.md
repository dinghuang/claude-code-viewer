# Claude Code Viewer 设计文档

一个用于可视化 Claude Code 执行过程的 Web 应用，集成 CopilotKit 提供美化的交互界面。

## 文档索引

### 核心设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [架构设计](architecture.md) | 系统整体架构和技术选型 | `@docs/architecture.md` |
| [数据流设计](data-flow.md) | 消息流向和处理流程 | `@docs/data-flow.md` |
| [配置管理](configuration.md) | 环境变量、系统提示词配置 | `@docs/configuration.md` |

### 模块设计

| 文档 | 说明 | 路径 |
|------|------|------|
| [后端设计](backend.md) | Python FastAPI 后端模块设计 | `@docs/backend.md` |
| [前端设计](frontend.md) | React + CopilotKit 前端组件设计 | `@docs/frontend.md` |

### 集成指南

| 文档 | 说明 | 路径 |
|------|------|------|
| [CopilotKit 集成](copilotkit-integration.md) | CopilotKit 集成说明 | `@docs/copilotkit-integration.md` |

## 快速开始

### 后端

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 API 密钥和系统提示词路径
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

## 功能特点

- 🖥️ **左侧手机框架**: 显示 CopilotKit 美化的交互界面
- 📋 **右侧思维面板**: 显示 Claude Code 完整思维过程
- 🔄 **双向交互**: 用户通过 CopilotKit 界面回复权限请求
- 📝 **系统提示词**: 首次对话前自动加载可配置的系统提示词
- 🎨 **丰富 UI**: 权限卡片、下拉选择器、进度指示器、结果摘要
