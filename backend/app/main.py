"""FastAPI 主入口"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from .ws import websocket_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 Claude Code Viewer 启动中...")
    yield
    logger.info("👋 Claude Code Viewer 关闭中...")


app = FastAPI(
    title="Claude Code Viewer",
    description="可视化 Claude Code 执行过程的后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 WebSocket 路由
app.include_router(websocket_router)


@app.get("/")
async def root():
    """健康检查"""
    return {"status": "ok", "service": "Claude Code Viewer API"}


@app.get("/health")
async def health():
    """健康检查端点"""
    return {"status": "healthy"}
