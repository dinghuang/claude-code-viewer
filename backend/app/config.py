# backend/app/config.py
"""Configuration management using Pydantic Settings."""

from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    """Application configuration."""

    # ============ Claude Code SDK 配置 ============
    anthropic_api_key: str
    anthropic_auth_token: str
    anthropic_base_url: str = "https://api.anthropic.com"
    anthropic_model: str = "claude-sonnet-4-5"

    # Claude Code CLI
    claude_code_cli_path: Optional[str] = None
    working_directory: str = "."

    # Claude Code MCP 服务器 (JSON 字符串或空)
    claude_code_mcp_servers: Optional[str] = None

    # ============ CopilotKit 配置 ============
    copilotkit_llm_api_key: Optional[str] = None
    copilotkit_llm_base_url: Optional[str] = None
    copilotkit_llm_model: str = "claude-sonnet-4-5"

    # ============ 系统提示词配置 ============
    system_prompt_path: str = "./system_prompt.md"
    user_info_path: str = "./user_info.md"

    # ============ 服务配置 ============
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_system_prompt(self) -> Optional[str]:
        """加载系统提示词"""
        prompt_path = Path(self.system_prompt_path)
        if not prompt_path.exists():
            return None

        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read().strip()

    def get_user_info(self) -> Optional[str]:
        """加载用户信息"""
        info_path = Path(self.user_info_path)
        if not info_path.exists():
            return None

        with open(info_path, "r", encoding="utf-8") as f:
            return f.read().strip()


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
