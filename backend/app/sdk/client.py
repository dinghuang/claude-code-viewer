# backend/app/sdk/client.py
"""Build ClaudeAgentOptions from app settings."""

import os
from app.config import get_settings


def build_claude_options():
    """Build ClaudeAgentOptions dict from app settings.

    Returns a dict of kwargs suitable for ClaudeAgentOptions().
    The caller adds can_use_tool and system_prompt as needed.
    """
    settings = get_settings()

    # Set env vars for the Claude Code CLI subprocess
    os.environ.setdefault("ANTHROPIC_API_KEY", settings.anthropic_api_key)
    os.environ.setdefault("ANTHROPIC_AUTH_TOKEN", settings.anthropic_auth_token)
    os.environ.setdefault("ANTHROPIC_BASE_URL", settings.anthropic_base_url)

    opts = {
        "model": settings.anthropic_model,
        "cwd": settings.working_directory,
    }
    if settings.claude_code_cli_path:
        opts["cli_path"] = settings.claude_code_cli_path

    return opts
