# backend/app/main.py
"""FastAPI 主入口 - 集成 CopilotKit 和 Claude SDK"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import get_settings
from app.agents.claude_code_agent import ClaudeCodeAgent
from app.api import process_stream

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 Claude Code Viewer 启动中...")
    logger.info(f"   工作目录: {settings.working_directory}")
    logger.info(f"   模型: {settings.anthropic_model}")

    # 检查系统提示词
    system_prompt = settings.get_system_prompt()
    if system_prompt:
        logger.info(f"   系统提示词已加载 ({len(system_prompt)} 字符)")
    else:
        logger.warning("   未找到系统提示词文件")

    yield
    logger.info("👋 Claude Code Viewer 关闭中...")


app = FastAPI(
    title="Claude Code Viewer",
    description="可视化 Claude Code 执行过程",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由
app.include_router(process_stream.router, prefix="/api", tags=["stream"])


def create_copilotkit_endpoint():
    """创建 CopilotKit Endpoint"""
    try:
        from copilotkit.integrations.fastapi import add_fastapi_endpoint
        from copilotkit import CopilotKitSDK, CopilotKitContext
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            api_key=settings.copilotkit_llm_api_key,
            base_url=settings.copilotkit_llm_base_url,
            model=settings.copilotkit_llm_model,
        )

        agent = ClaudeCodeAgent(
            name="claude_code",
            description="Claude Code 助手 - 执行代码任务",
            working_dir=settings.working_directory,
        )

        sdk = CopilotKitSDK(
            agents=[agent],
        )

        # 注册 CopilotKit 端点
        add_fastapi_endpoint(app, sdk, "/copilotkit")

        logger.info("   CopilotKit 端点已注册: /copilotkit")
        return sdk

    except ImportError as e:
        logger.warning(f"CopilotKit 未安装，跳过集成: {e}")
        return None
    except Exception as e:
        logger.error(f"CopilotKit 集成失败: {e}")
        return None


# 注册 CopilotKit 端点
copilotkit_sdk = create_copilotkit_endpoint()


@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "Claude Code Viewer API",
        "version": "0.2.0",
        "docs": "/docs",
        "copilotkit": "/copilotkit" if copilotkit_sdk else None,
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}
