# backend/app/main.py
"""FastAPI entry point — AG-UI endpoint with Claude Code LangGraph Agent."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import warnings

from app.config import get_settings
from app.api import process_stream
from app.agents.claude_code_agent import (
    build_graph, set_system_prompt, get_effective_system_prompt,
    set_permission_mode, get_permission_mode,
)
from ag_ui_langgraph import LangGraphAgent, add_langgraph_fastapi_endpoint

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Claude Code Viewer 启动中...")
    logger.info(f"   工作目录: {settings.working_directory}")
    logger.info(f"   模型: {settings.anthropic_model}")

    system_prompt = settings.get_system_prompt()
    if system_prompt:
        logger.info(f"   系统提示词已加载 ({len(system_prompt)} 字符)")
    else:
        logger.warning("   未找到系统提示词文件")

    logger.info("   AG-UI 端点: POST /")
    logger.info("   SSE 端点: GET /api/process-stream")

    yield
    logger.info("👋 Claude Code Viewer 关闭中...")


app = FastAPI(
    title="Claude Code Viewer",
    description="可视化 Claude Code 执行过程",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# SSE thinking process
app.include_router(process_stream.router, prefix="/api", tags=["stream"])

# Claude Code LangGraph Agent
compiled_graph = build_graph()

agent = LangGraphAgent(
    name="claude_code",
    description="Claude Code 助手 - 执行代码任务",
    graph=compiled_graph,
)

add_langgraph_fastapi_endpoint(app, agent, path="/")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/system-prompt")
async def get_system_prompt():
    """Get current system prompt."""
    prompt = get_effective_system_prompt()
    return {"prompt": prompt or ""}


@app.post("/api/system-prompt")
async def update_system_prompt(request: Request):
    """Update system prompt from frontend."""
    body = await request.json()
    prompt = body.get("prompt", "")
    set_system_prompt(prompt)
    logger.info(f"系统提示词已更新 ({len(prompt)} 字符)")
    return {"status": "ok", "length": len(prompt)}


@app.get("/api/permission-mode")
async def get_perm_mode():
    """Get current permission mode."""
    return {"mode": get_permission_mode()}


@app.post("/api/permission-mode")
async def update_perm_mode(request: Request):
    """Update permission mode from frontend."""
    body = await request.json()
    mode = body.get("mode", "bypassPermissions")
    set_permission_mode(mode)
    logger.info(f"权限模式已更新: {mode}")
    return {"status": "ok", "mode": mode}
