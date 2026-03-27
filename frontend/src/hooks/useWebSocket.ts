import { useEffect, useRef, useCallback, useState } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, any>
  output?: any
}

export interface PermissionRequest {
  id: string
  title: string
  description: string
  toolName: string
  riskLevel: 'low' | 'medium' | 'high'
}

export interface SelectionRequest {
  id: string
  title: string
  options: string[]
  multiSelect: boolean
}

export interface SummaryData {
  id: string
  title: string
  content: string
  actions: string[]
}

interface WebSocketHook {
  sendResponse: (response: any) => void
  isConnected: boolean
}

export function useWebSocket(onMessage: (data: any) => void): WebSocketHook {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected')
      setIsConnected(true)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
      // 重连逻辑
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch (e) {
        console.error('Failed to parse message:', e)
      }
    }
  }, [onMessage])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendResponse = useCallback((response: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(response))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  return { sendResponse, isConnected }
}
