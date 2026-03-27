# backend/app/api/process_stream.py
"""Process Stream SSE endpoint for broadcasting Claude's thinking process."""

from fastapi import APIRouter
from sse_starlette import EventSourceResponse
import json
import asyncio
from typing import List
from app.models import ProcessMessage

router = APIRouter()

# 存储活跃的订阅者
_subscribers: List[asyncio.Queue] = []


@router.get("/process-stream")
async def process_stream():
    """思维过程 SSE 流"""
    async def event_generator():
        queue = asyncio.Queue()
        _subscribers.append(queue)

        try:
            while True:
                msg = await queue.get()
                yield {
                    "event": "message",
                    "data": json.dumps(msg.model_dump()),
                }
        except asyncio.CancelledError:
            if queue in _subscribers:
                _subscribers.remove(queue)

    return EventSourceResponse(event_generator())


async def broadcast_to_subscribers(msg: ProcessMessage):
    """广播消息到所有订阅者"""
    for queue in _subscribers:
        try:
            await queue.put(msg)
        except Exception:
            pass  # 忽略已关闭的连接
