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

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'

export interface WebSocketState {
  isConnected: boolean
  status: ConnectionStatus
  error: string | null
  reconnectAttempts: number
}

interface WebSocketHook {
  sendResponse: (response: any) => void
  sendTask: (task: string) => void
  reconnect: () => void
  disconnect: () => void
  state: WebSocketState
}

// 重连配置
const RECONNECT_CONFIG = {
  maxAttempts: 10,
  baseDelay: 1000, // 1秒
  maxDelay: 30000, // 30秒
  backoffMultiplier: 1.5,
}

// 计算重连延迟（指数退避）
function getReconnectDelay(attempt: number): number {
  const delay = Math.min(
    RECONNECT_CONFIG.baseDelay * Math.pow(RECONNECT_CONFIG.backoffMultiplier, attempt),
    RECONNECT_CONFIG.maxDelay
  )
  // 添加随机抖动避免同时重连
  return delay + Math.random() * 1000
}

export function useWebSocket(onMessage: (data: any) => void): WebSocketHook {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const isManualCloseRef = useRef(false)
  const messageQueueRef = useRef<any[]>([])
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    status: 'connecting',
    error: null,
    reconnectAttempts: 0,
  })

  const processMessageQueue = useCallback(() => {
    // 连接恢复后发送排队的消息
    while (messageQueueRef.current.length > 0 && 
           wsRef.current?.readyState === WebSocket.OPEN) {
      const message = messageQueueRef.current.shift()
      wsRef.current.send(JSON.stringify(message))
      console.log('📤 Sent queued message:', message.type)
    }
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    
    setState(prev => ({
      ...prev,
      status: reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting',
      error: null,
    }))

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        isManualCloseRef.current = false
        reconnectAttemptsRef.current = 0
        
        setState({
          isConnected: true,
          status: 'connected',
          error: null,
          reconnectAttempts: 0,
        })

        // 处理排队的消息
        processMessageQueue()
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code, event.reason)
        wsRef.current = null
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          status: 'disconnected',
        }))

        // 如果不是手动关闭，尝试重连
        if (!isManualCloseRef.current && reconnectAttemptsRef.current < RECONNECT_CONFIG.maxAttempts) {
          const delay = getReconnectDelay(reconnectAttemptsRef.current)
          console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current + 1}/${RECONNECT_CONFIG.maxAttempts})`)
          
          setState(prev => ({
            ...prev,
            status: 'reconnecting',
            reconnectAttempts: reconnectAttemptsRef.current,
          }))

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        } else if (reconnectAttemptsRef.current >= RECONNECT_CONFIG.maxAttempts) {
          console.error('❌ Max reconnect attempts reached')
          setState(prev => ({
            ...prev,
            status: 'error',
            error: '连接失败，请刷新页面重试',
          }))
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setState(prev => ({
          ...prev,
          error: '连接发生错误',
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage(data)
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setState(prev => ({
        ...prev,
        status: 'error',
        error: '无法建立连接',
      }))
    }
  }, [onMessage, processMessageQueue])

  const disconnect = useCallback(() => {
    isManualCloseRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    setState({
      isConnected: false,
      status: 'disconnected',
      error: null,
      reconnectAttempts: 0,
    })
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    isManualCloseRef.current = false
    setTimeout(connect, 100)
  }, [connect, disconnect])

  useEffect(() => {
    connect()

    return () => {
      isManualCloseRef.current = true
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount')
      }
    }
  }, [connect])

  const sendResponse = useCallback((response: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(response))
    } else {
      console.warn('WebSocket is not connected, queuing message')
      // 将消息加入队列，等待重连后发送
      messageQueueRef.current.push(response)
    }
  }, [])

  const sendTask = useCallback((task: string) => {
    const message = {
      type: 'start_task',
      task,
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected, queuing task')
      messageQueueRef.current.push(message)
    }
  }, [])

  return { 
    sendResponse, 
    sendTask, 
    reconnect,
    disconnect,
    state,
  }
}
