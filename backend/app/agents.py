"""
Claude Code Agent - 与 Claude Code CLI 交互的核心类
"""
import asyncio
import json
import os
import subprocess
import uuid
from typing import Optional, AsyncGenerator, Any
from dataclasses import dataclass, field
from enum import Enum

from .models import (
    MessageType,
    PermissionLevel,
    create_message,
    create_permission_request,
    create_selection_request,
    create_summary,
)


class AgentState(Enum):
    """Agent 状态"""
    IDLE = "idle"
    PROCESSING = "processing"
    WAITING_PERMISSION = "waiting_permission"
    WAITING_SELECTION = "waiting_selection"
    COMPLETED = "completed"
    ERROR = "error"


# ============ 工具风险等级定义 (模块级别常量) ============

TOOL_RISK_LEVELS: dict[str, PermissionLevel] = {
    # 低风险 - 只读操作
    "read": PermissionLevel.LOW,
    "ls": PermissionLevel.LOW,
    "glob": PermissionLevel.LOW,
    "grep": PermissionLevel.LOW,
    "search": PermissionLevel.LOW,
    "web_fetch": PermissionLevel.LOW,
    "web_search": PermissionLevel.LOW,
    
    # 中风险 - 可能影响项目
    "write": PermissionLevel.MEDIUM,
    "edit": PermissionLevel.MEDIUM,
    "mkdir": PermissionLevel.MEDIUM,
    "git": PermissionLevel.MEDIUM,
    "npm": PermissionLevel.MEDIUM,
    "pip": PermissionLevel.MEDIUM,
    
    # 高风险 - 系统级操作
    "exec": PermissionLevel.HIGH,
    "shell": PermissionLevel.HIGH,
    "rm": PermissionLevel.HIGH,
    "delete": PermissionLevel.HIGH,
    "sudo": PermissionLevel.HIGH,
}

TOOL_DESCRIPTIONS: dict[str, str] = {
    "read": "读取文件",
    "write": "写入文件",
    "edit": "编辑文件",
    "exec": "执行命令",
    "git": "Git 操作",
    "npm": "NPM 操作",
    "web_fetch": "获取网页",
    "web_search": "搜索",
}


def get_tool_risk(tool_name: str) -> PermissionLevel:
    """获取工具的风险等级"""
    return TOOL_RISK_LEVELS.get(tool_name.lower(), PermissionLevel.MEDIUM)


def get_tool_description(tool_name: str, arguments: dict) -> str:
    """生成工具调用的可读描述"""
    base_desc = TOOL_DESCRIPTIONS.get(tool_name.lower(), f"执行工具: {tool_name}")
    
    if tool_name.lower() == "read":
        return f"读取文件: {arguments.get('file_path', '未知')}"
    elif tool_name.lower() == "write":
        return f"写入文件: {arguments.get('file_path', '未知')}"
    elif tool_name.lower() == "edit":
        return f"编辑文件: {arguments.get('file_path', '未知')}"
    elif tool_name.lower() == "exec":
        return f"执行命令: {arguments.get('command', '未知')}"
    elif tool_name.lower() == "git":
        args = arguments.get('args', [])
        return f"Git 操作: {args[0] if args else '未知'}"
    elif tool_name.lower() == "web_fetch":
        return f"获取网页: {arguments.get('url', '未知')}"
    elif tool_name.lower() == "web_search":
        return f"搜索: {arguments.get('query', '未知')}"
    
    return base_desc


class ClaudeCodeAgent:
    """
    Claude Code Agent - 模拟与 Claude Code CLI 的交互
    
    支持的功能:
    - 实时消息流
    - 权限请求与响应
    - 选择请求与响应
    - 任务总结
    """
    
    def __init__(
        self,
        session_id: str = None,
        working_dir: str = None,
    ):
        self.session_id = session_id or str(uuid.uuid4())
        self.state = AgentState.IDLE
        self.working_dir = working_dir or os.getcwd()
        
        # 内部状态
        self._process: Optional[asyncio.subprocess.Process] = None
        self._pending_permission: Optional[dict] = None
        self._pending_selection: Optional[dict] = None
        self._message_queue: asyncio.Queue = asyncio.Queue()
    
    @property
    def is_connected(self) -> bool:
        """检查是否已连接"""
        return self._process is not None and self._process.returncode is None
    
    # ============ 核心方法 ============
    
    async def connect(self) -> bool:
        """
        连接到 Claude Code CLI
        
        实际项目中，这里会启动 Claude Code 进程并建立通信
        目前使用模拟模式
        """
        try:
            self.state = AgentState.IDLE
            
            # 发送连接成功消息
            await self._message_queue.put(create_message(
                role="system",
                content="已连接到 Claude Code Agent",
                message_type=MessageType.SYSTEM,
            ))
            
            return True
        except Exception as e:
            self.state = AgentState.ERROR
            await self._message_queue.put(create_message(
                role="system",
                content=f"连接失败: {str(e)}",
                message_type=MessageType.ERROR,
            ))
            return False
    
    async def disconnect(self):
        """断开连接"""
        if self._process:
            try:
                self._process.terminate()
                await self._process.wait()
            except:
                pass
            finally:
                self._process = None
        
        self.state = AgentState.IDLE
    
    async def send_message(self, content: str) -> AsyncGenerator[dict, None]:
        """
        发送消息给 Claude 并获取响应流
        
        Args:
            content: 用户消息内容
            
        Yields:
            各种类型的消息字典
        """
        if self.state != AgentState.IDLE:
            yield create_message(
                role="system",
                content="Agent 正忙，请等待当前任务完成",
                message_type=MessageType.ERROR,
            )
            return
        
        self.state = AgentState.PROCESSING
        
        try:
            # 1. 添加用户消息
            user_msg = create_message(
                role="user",
                content=content,
            )
            yield user_msg
            await self._message_queue.put(user_msg)
            
            # 2. 模拟 Claude 处理过程
            async for event in self._process_message(content):
                yield event
                await self._message_queue.put(event)
                
                # 如果需要权限或选择，暂停处理
                if event.get("type") in [MessageType.PERMISSION_REQUEST.value, MessageType.SELECTION_REQUEST.value]:
                    return
            
            # 3. 完成
            self.state = AgentState.IDLE
            
        except Exception as e:
            self.state = AgentState.ERROR
            error_msg = create_message(
                role="system",
                content=f"处理出错: {str(e)}",
                message_type=MessageType.ERROR,
            )
            yield error_msg
            await self._message_queue.put(error_msg)
    
    async def _process_message(self, content: str) -> AsyncGenerator[dict, None]:
        """
        处理消息的核心逻辑 - 模拟 Claude Code 的行为
        
        实际项目中，这里会与 Claude Code CLI 进行通信
        目前使用模拟模式来演示交互流程
        """
        # 模拟 Claude 开始思考
        thinking_msg = create_message(
            role="assistant",
            content="让我思考一下...",
            message_type=MessageType.THINKING,
        )
        yield thinking_msg
        
        await asyncio.sleep(0.5)
        
        # 根据用户输入模拟不同的交互场景
        content_lower = content.lower()
        
        if "帮我" in content or "执行" in content or "运行" in content:
            # 模拟需要权限的操作
            async for event in self._simulate_permission_flow(content):
                yield event
        
        elif "选择" in content or "哪个" in content or "选哪个" in content:
            # 模拟需要选择的情况
            async for event in self._simulate_selection_flow(content):
                yield event
        
        else:
            # 普通对话
            response_msg = create_message(
                role="assistant",
                content=self._generate_response(content),
            )
            yield response_msg
    
    async def _simulate_permission_flow(self, content: str) -> AsyncGenerator[dict, None]:
        """模拟权限请求流程"""
        # 1. Claude 表示要执行操作
        action_msg = create_message(
            role="assistant",
            content="我需要执行一个操作来完成这个任务。",
        )
        yield action_msg
        
        await asyncio.sleep(0.3)
        
        # 2. 发起权限请求
        tool_name = "exec" if "命令" in content else "write"
        permission_req = create_permission_request(
            title="执行操作确认",
            tool_name=tool_name,
            description=get_tool_description(tool_name, {"command": content}),
            risk_level=get_tool_risk(tool_name),
        )
        self._pending_permission = permission_req
        self.state = AgentState.WAITING_PERMISSION
        yield permission_req
    
    async def _simulate_selection_flow(self, content: str) -> AsyncGenerator[dict, None]:
        """模拟选择请求流程"""
        # 1. Claude 表示需要用户选择
        ask_msg = create_message(
            role="assistant",
            content="我需要你帮我做一个选择。",
        )
        yield ask_msg
        
        await asyncio.sleep(0.3)
        
        # 2. 发起选择请求
        selection_req = create_selection_request(
            title="请选择一个选项",
            options=["选项 A - 推荐", "选项 B - 备选", "选项 C - 自定义"],
            multi_select=False,
        )
        self._pending_selection = selection_req
        self.state = AgentState.WAITING_SELECTION
        yield selection_req
    
    def _generate_response(self, content: str) -> str:
        """生成简单的对话响应"""
        responses = {
            "你好": "你好！有什么我可以帮助你的吗？",
            "hello": "Hello! How can I help you today?",
            "帮助": "我可以帮你执行各种开发任务，比如读取文件、编辑代码、运行命令等。你只需要告诉我你想做什么！",
            "状态": f"当前状态: {self.state.value}\n会话ID: {self.session_id}\n工作目录: {self.working_dir}",
        }
        
        for key, response in responses.items():
            if key in content.lower():
                return response
        
        return f"收到你的消息。如果你需要我执行具体操作（如读写文件、运行命令等），请告诉我详细需求。"
    
    # ============ 权限响应 ============
    
    async def respond_permission(self, approved: bool, session_id: str) -> AsyncGenerator[dict, None]:
        """
        响应权限请求
        
        Args:
            approved: 是否批准
            session_id: 会话ID
            
        Yields:
            处理结果消息
        """
        if not self._pending_permission:
            yield create_message(
                role="system",
                content="没有待处理的权限请求",
                message_type=MessageType.ERROR,
            )
            return
        
        permission = self._pending_permission
        self._pending_permission = None
        
        if approved:
            # 用户批准 - 执行操作
            self.state = AgentState.PROCESSING
            
            result_msg = create_message(
                role="assistant",
                content=f"✅ 已批准执行 {permission['data']['toolName']}，操作进行中...",
            )
            yield result_msg
            await self._message_queue.put(result_msg)
            
            # 模拟执行过程
            await asyncio.sleep(1)
            
            # 发送总结
            summary = create_summary(
                title="操作完成",
                content=f"已成功执行 {permission['data']['toolName']} 操作",
                actions=[
                    f"执行了 {permission['data']['toolName']}",
                    "操作已完成，无错误",
                ],
            )
            yield summary
            await self._message_queue.put(summary)
            
        else:
            # 用户拒绝
            result_msg = create_message(
                role="assistant",
                content=f"❌ 已取消执行 {permission['data']['toolName']}",
            )
            yield result_msg
            await self._message_queue.put(result_msg)
        
        self.state = AgentState.IDLE
    
    # ============ 选择响应 ============
    
    async def respond_selection(self, selected: str, session_id: str) -> AsyncGenerator[dict, None]:
        """
        响应选择请求
        
        Args:
            selected: 用户选择的选项
            session_id: 会话ID
            
        Yields:
            处理结果消息
        """
        if not self._pending_selection:
            yield create_message(
                role="system",
                content="没有待处理的选择请求",
                message_type=MessageType.ERROR,
            )
            return
        
        self._pending_selection = None
        self.state = AgentState.PROCESSING
        
        # 用户做出选择
        result_msg = create_message(
            role="assistant",
            content=f"好的，你选择了: **{selected}**\n让我继续处理...",
        )
        yield result_msg
        await self._message_queue.put(result_msg)
        
        # 模拟处理过程
        await asyncio.sleep(1)
        
        # 发送总结
        summary = create_summary(
            title="任务完成",
            content=f"根据你的选择「{selected}」，任务已完成",
            actions=[
                f"使用了选项: {selected}",
                "相关配置已更新",
                "任务完成",
            ],
        )
        yield summary
        await self._message_queue.put(summary)
        
        self.state = AgentState.IDLE
    
    # ============ 消息历史 ============
    
    async def get_history(self, limit: int = 50) -> list[dict]:
        """获取消息历史"""
        messages = []
        temp_queue = asyncio.Queue()
        
        # 从队列中取出消息
        while not self._message_queue.empty():
            msg = await self._message_queue.get()
            messages.append(msg)
            await temp_queue.put(msg)
        
        # 放回队列
        while not temp_queue.empty():
            msg = await temp_queue.get()
            await self._message_queue.put(msg)
        
        return messages[-limit:]


# ============ Agent 管理器 ============

class AgentManager:
    """
    Agent 实例管理器
    
    支持多会话管理，每个 WebSocket 连接对应一个 Agent 实例
    """
    
    def __init__(self):
        self._agents: dict[str, ClaudeCodeAgent] = {}
    
    def get_or_create(self, session_id: str, working_dir: str = None) -> ClaudeCodeAgent:
        """获取或创建 Agent 实例"""
        if session_id not in self._agents:
            agent = ClaudeCodeAgent(
                session_id=session_id,
                working_dir=working_dir or os.getcwd(),
            )
            self._agents[session_id] = agent
        return self._agents[session_id]
    
    def get(self, session_id: str) -> Optional[ClaudeCodeAgent]:
        """获取 Agent 实例"""
        return self._agents.get(session_id)
    
    def remove(self, session_id: str):
        """移除 Agent 实例"""
        if session_id in self._agents:
            agent = self._agents.pop(session_id)
            # 注意: 这里应该 await agent.disconnect()，但这是同步方法
            # 实际使用时应该在异步上下文中处理
            self._agents.pop(session_id, None)
    
    @property
    def active_count(self) -> int:
        """获取活跃 Agent 数量"""
        return len(self._agents)


# 全局 Agent 管理器实例
agent_manager = AgentManager()
