# backend/app/models.py
"""Data models for process messages."""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from enum import Enum


class ProcessMessageType(str, Enum):
    """思维过程消息类型"""
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    TEXT = "text"
    PERMISSION = "permission"
    RESULT = "result"
    ERROR = "error"


class ProcessMessage(BaseModel):
    """思维过程消息"""
    id: str
    type: ProcessMessageType
    content: str
    timestamp: int

    # 工具相关
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_result: Optional[Any] = None

    # 权限相关
    risk_level: Optional[str] = None

    # 结果相关
    actions: Optional[List[str]] = None
    cost: Optional[float] = None
