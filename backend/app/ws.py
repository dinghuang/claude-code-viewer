"""WebSocket 处理模块"""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
import logging

from .models import (
    Message, MessageRole, PermissionRequest, SelectionRequest, SummaryData,
    WSMessage, PermissionResponse, SelectionResponse, RiskLevel
)
from .agents import ClaudeCodeAgent

logger = logging.getLogger(__name__)

websocket_router = APIRouter()


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.pending_requests: Dict[str, asyncio.Future] = {}

    async def connect(self, websocket: WebSocket):
        """接受新的 WebSocket 连接"""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"✅ 新连接，当前连接数: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """断开连接"""
        self.active_connections.discard(websocket)
        logger.info(f"❌ 连接断开，当前连接数: {len(self.active_connections)}")

    async def send_json(self, websocket: WebSocket, data: dict):
        """发送 JSON 数据"""
        try:
            await websocket.send_json(data)
        except Exception as e:
            logger.error(f"发送消息失败: {e}")

    async def broadcast(self, data: dict):
        """广播消息到所有连接"""
        for connection in self.active_connections:
            await self.send_json(connection, data)


manager = ConnectionManager()


async def handle_permission_response(response: PermissionResponse):
    """处理权限响应"""
    request_id = response.requestId
    if request_id in manager.pending_requests:
        future = manager.pending_requests.pop(request_id)
        future.set_result(response.approved)
        logger.info(f"✅ 权限响应已处理: {request_id} -> {response.approved}")


async def handle_selection_response(response: SelectionResponse):
    """处理选择响应"""
    request_id = response.requestId
    if request_id in manager.pending_requests:
        future = manager.pending_requests.pop(request_id)
        future.set_result(response.selectedOption)
        logger.info(f"✅ 选择响应已处理: {request_id} -> {response.selectedOption}")


async def request_permission(
    websocket: WebSocket,
    title: str,
    description: str,
    tool_name: str,
    risk_level: RiskLevel = RiskLevel.MEDIUM,
    timeout: float = 60.0
) -> bool:
    """请求权限确认"""
    request_id = str(uuid.uuid4())
    request = PermissionRequest(
        id=request_id,
        title=title,
        description=description,
        toolName=tool_name,
        riskLevel=risk_level,
    )

    # 创建 Future 等待响应
    future: asyncio.Future[bool] = asyncio.get_event_loop().create_future()
    manager.pending_requests[request_id] = future

    # 发送权限请求
    await manager.send_json(websocket, {
        "type": "permission_request",
        "payload": request.model_dump(),
    })

    try:
        # 等待用户响应
        result = await asyncio.wait_for(future, timeout=timeout)
        # 清除权限请求 UI
        await manager.send_json(websocket, {
            "type": "clear_permission",
        })
        return result
    except asyncio.TimeoutError:
        logger.warning(f"⚠️ 权限请求超时: {request_id}")
        manager.pending_requests.pop(request_id, None)
        # 清除权限请求 UI
        await manager.send_json(websocket, {
            "type": "clear_permission",
        })
        return False


async def request_selection(
    websocket: WebSocket,
    title: str,
    options: list[str],
    multi_select: bool = False,
    timeout: float = 60.0
) -> str:
    """请求用户选择"""
    request_id = str(uuid.uuid4())
    request = SelectionRequest(
        id=request_id,
        title=title,
        options=options,
        multiSelect=multi_select,
    )

    # 创建 Future 等待响应
    future: asyncio.Future[str] = asyncio.get_event_loop().create_future()
    manager.pending_requests[request_id] = future

    # 发送选择请求
    await manager.send_json(websocket, {
        "type": "selection_request",
        "payload": request.model_dump(),
    })

    try:
        # 等待用户响应
        result = await asyncio.wait_for(future, timeout=timeout)
        # 清除选择请求 UI
        await manager.send_json(websocket, {
            "type": "clear_selection",
        })
        return result
    except asyncio.TimeoutError:
        logger.warning(f"⚠️ 选择请求超时: {request_id}")
        manager.pending_requests.pop(request_id, None)
        # 清除选择请求 UI
        await manager.send_json(websocket, {
            "type": "clear_selection",
        })
        return options[0] if options else ""


async def send_message(websocket: WebSocket, message: Message):
    """发送消息到前端"""
    await manager.send_json(websocket, {
        "type": "message",
        "payload": message.model_dump(),
    })


async def send_summary(websocket: WebSocket, summary: SummaryData):
    """发送总结到前端"""
    await manager.send_json(websocket, {
        "type": "summary",
        "payload": summary.model_dump(),
    })


@websocket_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket 主入口"""
    await manager.connect(websocket)

    # 发送欢迎消息
    welcome_message = Message(
        id=str(uuid.uuid4()),
        role=MessageRole.SYSTEM,
        content="已连接到 Claude Code Viewer，等待任务...",
        timestamp=int(datetime.now().timestamp() * 1000),
    )
    await send_message(websocket, welcome_message)

    try:
        while True:
            # 接收消息
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")

                if msg_type == "permission_response":
                    response = PermissionResponse(**message)
                    await handle_permission_response(response)

                elif msg_type == "selection_response":
                    response = SelectionResponse(**message)
                    await handle_selection_response(response)

                elif msg_type == "start_task":
                    # 启动任务
                    task = message.get("task", "")
                    await run_claude_code_task(websocket, task)

                elif msg_type == "ping":
                    # 心跳
                    await manager.send_json(websocket, {"type": "pong"})

                else:
                    logger.warning(f"未知消息类型: {msg_type}")

            except json.JSONDecodeError:
                logger.error(f"无效的 JSON 数据: {data}")
            except Exception as e:
                logger.error(f"处理消息时出错: {e}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket 错误: {e}")
        manager.disconnect(websocket)


async def run_claude_code_task(websocket: WebSocket, task: str):
    """运行 Claude Code 任务"""
    agent = ClaudeCodeAgent()

    # 发送用户消息
    user_message = Message(
        id=str(uuid.uuid4()),
        role=MessageRole.USER,
        content=task,
        timestamp=int(datetime.now().timestamp() * 1000),
    )
    await send_message(websocket, user_message)

    try:
        async for event in agent.run(task):
            if event["type"] == "message":
                # 发送助手消息
                assistant_message = Message(
                    id=str(uuid.uuid4()),
                    role=MessageRole.ASSISTANT,
                    content=event["content"],
                    timestamp=int(datetime.now().timestamp() * 1000),
                    toolCalls=event.get("toolCalls"),
                )
                await send_message(websocket, assistant_message)

            elif event["type"] == "permission_request":
                # 请求权限
                approved = await request_permission(
                    websocket,
                    title=event["title"],
                    description=event["description"],
                    tool_name=event["toolName"],
                    risk_level=event.get("riskLevel", RiskLevel.MEDIUM),
                )
                # 将权限结果传回 agent
                await agent.respond_permission(event["id"], approved)

            elif event["type"] == "selection_request":
                # 请求选择
                selected = await request_selection(
                    websocket,
                    title=event["title"],
                    options=event["options"],
                    multi_select=event.get("multiSelect", False),
                )
                # 将选择结果传回 agent
                await agent.respond_selection(event["id"], selected)

            elif event["type"] == "summary":
                # 发送总结
                summary = SummaryData(
                    id=str(uuid.uuid4()),
                    title=event["title"],
                    content=event["content"],
                    actions=event["actions"],
                )
                await send_summary(websocket, summary)

    except Exception as e:
        logger.error(f"任务执行出错: {e}")
        error_message = Message(
            id=str(uuid.uuid4()),
            role=MessageRole.SYSTEM,
            content=f"❌ 任务执行出错: {str(e)}",
            timestamp=int(datetime.now().timestamp() * 1000),
        )
        await send_message(websocket, error_message)
