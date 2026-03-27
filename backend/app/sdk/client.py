# backend/app/sdk/client.py
"""Claude SDK Client wrapper for claude-agent-sdk-python."""

import os
import sys
from pathlib import Path
from typing import Optional, Callable, Awaitable, Dict, Any

# Add local SDK to path
_sdk_path = Path(__file__).parent.parent.parent.parent / "claude-agent-sdk-python" / "src"
if _sdk_path.exists():
    sys.path.insert(0, str(_sdk_path))

from app.config import get_settings


def create_claude_client(
    working_dir: str = None,
    can_use_tool: Optional[Callable[
        [str, Dict[str, Any], Any],
        Awaitable[Any]
    ]] = None,
):
    """创建配置好的 Claude SDK 客户端

    Args:
        working_dir: 工作目录
        can_use_tool: 权限回调函数

    Returns:
        配置好的 ClaudeSDKClient 实例
    """
    settings = get_settings()

    # Import the actual SDK
    try:
        from claude_code_sdk import Claude, ClaudeCodeOptions
    except ImportError:
        # Fallback to local SDK
        from claude_code_sdk import Claude, ClaudeCodeOptions

    # Set environment variables for the SDK
    env = {
        "ANTHROPIC_API_KEY": settings.anthropic_api_key,
        "ANTHROPIC_AUTH_TOKEN": settings.anthropic_auth_token,
        "ANTHROPIC_BASE_URL": settings.anthropic_base_url,
    }

    # Update current environment
    for key, value in env.items():
        if value:
            os.environ[key] = value

    # Build options
    options = ClaudeCodeOptions(
        model=settings.anthropic_model,
        cwd=working_dir or settings.working_directory,
        permission_mode="acceptEdits" if can_use_tool is None else "interactive",
    )

    # Set CLI path if configured
    if settings.claude_code_cli_path:
        options.cli_path = settings.claude_code_cli_path

    return Claude(options=options)
