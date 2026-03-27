import React from 'react'
import { CopilotChat } from './CopilotChat'
import { PermissionDialog } from './PermissionDialog'
import { SelectionCard } from './SelectionCard'
import { SummaryCard } from './SummaryCard'
import { Message, PermissionRequest, SelectionRequest, SummaryData, ConnectionStatus, WebSocketState } from '../hooks/useWebSocket'

interface PhoneFrameProps {
  messages: Message[]
  permissionRequest: PermissionRequest | null
  selectionRequest: SelectionRequest | null
  summaryData: SummaryData | null
  onPermissionResponse: (approved: boolean) => void
  onSelectionResponse: (selectedOption: string) => void
  onSendTask: (task: string) => void
  onReconnect: () => void
  connectionState: WebSocketState
}

// 连接状态指示器
function ConnectionIndicator({ state, onReconnect }: { state: WebSocketState; onReconnect: () => void }) {
  const statusConfig: Record<ConnectionStatus, { color: string; text: string; icon: string }> = {
    connecting: { color: 'bg-yellow-400', text: '连接中...', icon: '🔄' },
    connected: { color: 'bg-green-400', text: '已连接', icon: '✓' },
    disconnected: { color: 'bg-red-400', text: '已断开', icon: '✗' },
    reconnecting: { color: 'bg-orange-400', text: `重连中(${state.reconnectAttempts})...`, icon: '🔄' },
    error: { color: 'bg-red-500', text: '连接错误', icon: '⚠' },
  }

  const config = statusConfig[state.status]

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${config.color} ${state.status === 'connecting' || state.status === 'reconnecting' ? 'animate-pulse' : ''}`} />
      <span className="text-white text-[10px] sm:text-xs">{config.text}</span>
      {(state.status === 'disconnected' || state.status === 'error') && (
        <button
          onClick={onReconnect}
          className="text-[10px] sm:text-xs text-white/80 hover:text-white underline"
        >
          重连
        </button>
      )}
    </div>
  )
}

export function PhoneFrame({
  messages,
  permissionRequest,
  selectionRequest,
  summaryData,
  onPermissionResponse,
  onSelectionResponse,
  onSendTask,
  onReconnect,
  connectionState,
}: PhoneFrameProps) {
  const [taskInput, setTaskInput] = React.useState('')
  const [isInputFocused, setIsInputFocused] = React.useState(false)

  const handleSendTask = () => {
    if (taskInput.trim() && connectionState.isConnected) {
      onSendTask(taskInput.trim())
      setTaskInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendTask()
    }
  }

  return (
    <div className="relative w-full">
      {/* 手机外框 - 响应式尺寸 */}
      <div className="w-full max-w-[375px] mx-auto aspect-[375/812] bg-black rounded-[6%] p-[3%] shadow-2xl">
        {/* 手机屏幕 */}
        <div className="w-full h-full bg-white rounded-[4.5%] overflow-hidden relative flex flex-col">
          {/* 刘海 */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-[40%] h-[3.5%] bg-black rounded-b-[15%] z-10">
            <div className="absolute top-[35%] left-1/2 transform -translate-x-1/2 w-[40%] h-[15%] bg-gray-800 rounded-full" />
          </div>

          {/* 状态栏 */}
          <div className="h-[7%] min-h-[40px] bg-white flex items-center justify-between px-[8%] pt-[4%]">
            <span className="text-[10px] sm:text-sm font-medium">9:41</span>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z"/>
              </svg>
              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/>
              </svg>
              <div className="flex items-center">
                <div className="w-5 sm:w-6 h-2.5 sm:h-3 border border-gray-600 rounded-sm relative">
                  <div className="absolute inset-0.5 bg-green-500 rounded-sm" style={{ width: '80%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* 应用标题 */}
          <div className="h-[10%] min-h-[50px] bg-primary-500 flex items-center justify-between px-[4%]">
            <div className="flex-1 min-w-0" />
            <h1 className="text-white text-[12px] sm:text-lg font-semibold truncate px-2">Claude Code Viewer</h1>
            <div className="flex-1 min-w-0 flex justify-end">
              <ConnectionIndicator state={connectionState} onReconnect={onReconnect} />
            </div>
          </div>

          {/* 错误提示 */}
          {connectionState.error && (
            <div className="bg-red-50 border-b border-red-100 px-[4%] py-[2%] text-center">
              <p className="text-red-600 text-[10px] sm:text-xs truncate">{connectionState.error}</p>
            </div>
          )}

          {/* 内容区域 */}
          <div className={`flex-1 overflow-hidden ${connectionState.error ? 'min-h-0' : ''}`}>
            <CopilotChat messages={messages} />

            {/* 权限请求对话框 */}
            {permissionRequest && (
              <div className="absolute inset-x-0 bottom-[70px] p-[4%] bg-white/95 backdrop-blur">
                <PermissionDialog
                  request={permissionRequest}
                  onResponse={onPermissionResponse}
                />
              </div>
            )}

            {/* 选择卡片 */}
            {selectionRequest && (
              <div className="absolute inset-x-0 bottom-[70px] p-[4%] bg-white/95 backdrop-blur">
                <SelectionCard
                  request={selectionRequest}
                  onSelect={onSelectionResponse}
                />
              </div>
            )}

            {/* 总结卡片 */}
            {summaryData && (
              <div className="absolute inset-x-0 bottom-[70px] p-[4%] bg-white/95 backdrop-blur">
                <SummaryCard data={summaryData} />
              </div>
            )}
          </div>

          {/* 任务输入区域 */}
          <div className="h-[70px] border-t border-gray-100 bg-white px-[3%] py-[2%] flex items-end gap-[2%]">
            <div className={`flex-1 bg-gray-100 rounded-2xl px-[4%] py-[2%] flex items-center transition-all ${isInputFocused ? 'ring-2 ring-primary-400 bg-white' : ''}`}>
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder={connectionState.isConnected ? "输入任务..." : "等待连接..."}
                className="flex-1 bg-transparent text-[12px] sm:text-sm outline-none placeholder-gray-400"
                disabled={!connectionState.isConnected}
              />
            </div>
            <button
              onClick={handleSendTask}
              disabled={!connectionState.isConnected || !taskInput.trim()}
              className={`w-[40px] h-[40px] sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                connectionState.isConnected && taskInput.trim()
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 active:scale-95'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          {/* 底部指示条 */}
          <div className="absolute bottom-[2%] left-1/2 transform -translate-x-1/2 w-[35%] h-[0.5%] bg-black rounded-full" />
        </div>
      </div>
    </div>
  )
}
