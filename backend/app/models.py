"""数据模型定义"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Literal
from enum import Enum
import time
import uuid


# ============ 枚举类型 ============

class RiskLevel(str, Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


# 别名 - 兼容 agents.py
PermissionLevel = RiskLevel


class MessageRole(str, Enum):
    """消息角色"""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class MessageType(str, Enum):
    """消息类型"""
    TEXT = "text"
    THINKING = "thinking"
    TOOL_USE = "tool_use"
    TOOL_RESULT = "tool_result"
    PERMISSION_REQUEST = "permission_request"
    SELECTION_REQUEST = "selection_request"
    SUMMARY = "summary"
    ERROR = "error"
    SYSTEM = "system"


# ============ 工厂函数 ============

def create_message(
    role: str,
    content: str,
    message_type: MessageType = MessageType.TEXT,
    **kwargs
) -> dict:
    """创建消息字典"""
    return {
        "id": str(uuid.uuid4()),
        "type": message_type.value if isinstance(message_type, MessageType) else message_type,
        "role": role,
        "content": content,
        "timestamp": int(time.time() * 1000),
        **kwargs
    }


def create_permission_request(
    title: str,
    tool_name: str,
    description: str,
    risk_level: PermissionLevel = PermissionLevel.MEDIUM,
) -> dict:
    """创建权限请求"""
    return {
        "id": str(uuid.uuid4()),
        "type": MessageType.PERMISSION_REQUEST.value,
        "data": {
            "title": title,
            "toolName": tool_name,
            "description": description,
            "riskLevel": risk_level.value,
        },
        "timestamp": int(time.time() * 1000),
    }


def create_selection_request(
    title: str,
    options: List[str],
    multi_select: bool = False,
) -> dict:
    """创建选择请求"""
    return {
        "id": str(uuid.uuid4()),
        "type": MessageType.SELECTION_REQUEST.value,
        "data": {
            "title": title,
            "options": options,
            "multiSelect": multi_select,
        },
        "timestamp": int(time.time() * 1000),
    }


def create_summary(
    title: str,
    content: str,
    actions: List[str] = None,
) -> dict:
    """创建总结"""
    return {
        "id": str(uuid.uuid4()),
        "type": MessageType.SUMMARY.value,
        "data": {
            "title": title,
            "content": content,
            "actions": actions or [],
        },
        "timestamp": int(time.time() * 1000),
    }


# ============ Pydantic 模型 ============

class ToolCall(BaseModel):
    """工具调用"""
    id: str
    name: str
    input: Dict[str, Any]
    output: Optional[Any] = None


class Message(BaseModel):
    """消息"""
    id: str
    role: MessageRole
    content: str
    timestamp: int
    type: Optional[MessageType] = MessageType.TEXT
    toolCalls: Optional[List[ToolCall]] = None


class PermissionRequest(BaseModel):
    """权限请求"""
    id: str
    title: str
    description: str
    toolName: str
    riskLevel: RiskLevel


class SelectionRequest(BaseModel):
    """选择请求"""
    id: str
    title: str
    options: List[str]
    multiSelect: bool


class SummaryData(BaseModel):
    """总结数据"""
    id: str
    title: str
    content: str
    actions: List[str]


# WebSocket 消息类型
class WSMessage(BaseModel):
    """WebSocket 消息基类"""
    type: str
    payload: Optional[Any] = None


class WSMessagePayload(BaseModel):
    """消息负载"""
    message: Message


class WSPermissionPayload(BaseModel):
    """权限请求负载"""
    request: PermissionRequest


class WSSelectionPayload(BaseModel):
    """选择请求负载"""
    request: SelectionRequest


class WSSummaryPayload(BaseModel):
    """总结负载"""
    data: SummaryData


# 响应类型
class PermissionResponse(BaseModel):
    """权限响应"""
    type: Literal["permission_response"] = "permission_response"
    requestId: str
    approved: bool


class SelectionResponse(BaseModel):
    """选择响应"""
    type: Literal["selection_response"] = "selection_response"
    requestId: str
    selectedOption: str
