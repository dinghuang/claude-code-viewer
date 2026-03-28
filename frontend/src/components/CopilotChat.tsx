import React, { useEffect, useRef } from 'react'
import { Message } from '../hooks/useWebSocket'

interface CopilotChatProps {
  messages: Message[]
}

export function CopilotChat({ messages }: CopilotChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'user':
        return '用户'
      case 'assistant':
        return 'Claude'
      case 'system':
        return '系统'
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-primary-500'
      case 'assistant':
        return 'bg-purple-500'
      case 'system':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm">等待连接 AI智能投顾...</p>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={`message-enter ${message.role === 'user' ? 'flex justify-end' : ''}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 ${
                message.role === 'user'
                  ? 'bg-primary-500 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              {/* 角色标签 */}
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded-full ${getRoleColor(message.role)} flex items-center justify-center`}>
                  <span className="text-white text-xs">
                    {getRoleLabel(message.role).charAt(0)}
                  </span>
                </div>
                <span className={`text-xs ${message.role === 'user' ? 'text-primary-100' : 'text-gray-500'}`}>
                  {getRoleLabel(message.role)}
                </span>
                <span className={`text-xs ${message.role === 'user' ? 'text-primary-200' : 'text-gray-400'}`}>
                  {formatTime(message.timestamp)}
                </span>
              </div>

              {/* 消息内容 */}
              <div className={`text-sm leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>
                {message.content}
              </div>

              {/* 工具调用 */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.toolCalls.map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white/10 rounded-lg p-2 text-xs"
                    >
                      <div className="flex items-center gap-1 text-gray-600">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">{tool.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}
