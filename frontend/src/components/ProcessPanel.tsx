import React, { useEffect, useRef } from 'react'
import { Message } from '../hooks/useWebSocket'

interface ProcessPanelProps {
  messages: Message[]
  isConnected: boolean
}

export function ProcessPanel({ messages, isConnected }: ProcessPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight
    }
  }, [messages])

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  const getMessageTypeColor = (role: string) => {
    switch (role) {
      case 'user':
        return 'border-l-blue-500 bg-blue-50'
      case 'assistant':
        return 'border-l-purple-500 bg-purple-50'
      case 'system':
        return 'border-l-gray-500 bg-gray-50'
      default:
        return 'border-l-gray-300 bg-gray-50'
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="font-semibold text-gray-200">Claude Code 消息流</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">{isConnected ? '已连接' : '未连接'}</span>
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={panelRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">等待消息...</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`border-l-4 rounded-r-lg p-3 ${getMessageTypeColor(message.role)}`}
            >
              {/* 消息头 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    message.role === 'user' ? 'bg-blue-200 text-blue-800' :
                    message.role === 'assistant' ? 'bg-purple-200 text-purple-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {message.role.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  #{message.id.slice(0, 8)}
                </span>
              </div>

              {/* 消息内容 */}
              <div className="text-sm text-gray-700 font-mono whitespace-pre-wrap break-words">
                {message.content}
              </div>

              {/* 工具调用 */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.toolCalls.map((tool) => (
                    <div key={tool.id} className="bg-gray-800 rounded p-2 text-xs">
                      <div className="flex items-center gap-2 text-yellow-400 mb-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-semibold">{tool.name}</span>
                      </div>
                      <div className="text-gray-400">
                        <div className="mb-1">Input:</div>
                        <pre className="bg-gray-900 p-1 rounded overflow-x-auto">
                          {JSON.stringify(tool.input, null, 2)}
                        </pre>
                        {tool.output && (
                          <>
                            <div className="mt-1 mb-1">Output:</div>
                            <pre className="bg-gray-900 p-1 rounded overflow-x-auto text-green-400">
                              {JSON.stringify(tool.output, null, 2)}
                            </pre>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500">
        共 {messages.length} 条消息
      </div>
    </div>
  )
}
