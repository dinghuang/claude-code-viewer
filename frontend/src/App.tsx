import { useState, useCallback } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { ProcessPanel } from './components/ProcessPanel'
import { useWebSocket, Message, PermissionRequest, SelectionRequest, SummaryData } from './hooks/useWebSocket'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [selectionRequest, setSelectionRequest] = useState<SelectionRequest | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [showPanel, setShowPanel] = useState(false) // 移动端切换面板

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'message':
        setMessages(prev => [...prev, data.payload])
        break
      case 'permission_request':
        setPermissionRequest(data.payload)
        break
      case 'selection_request':
        setSelectionRequest(data.payload)
        break
      case 'summary':
        setSummaryData(data.payload)
        break
      case 'clear_permission':
        setPermissionRequest(null)
        break
      case 'clear_selection':
        setSelectionRequest(null)
        break
    }
  }, [])

  const { sendResponse, sendTask, reconnect, state } = useWebSocket(handleMessage)

  const handlePermissionResponse = (approved: boolean) => {
    if (permissionRequest) {
      sendResponse({
        type: 'permission_response',
        requestId: permissionRequest.id,
        approved,
      })
      setPermissionRequest(null)
    }
  }

  const handleSelectionResponse = (selectedOption: string) => {
    if (selectionRequest) {
      sendResponse({
        type: 'selection_response',
        requestId: selectionRequest.id,
        selectedOption,
      })
      setSelectionRequest(null)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
      {/* 移动端顶部切换栏 */}
      <div className="lg:hidden flex bg-white border-b border-gray-200">
        <button
          onClick={() => setShowPanel(false)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            !showPanel 
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50' 
              : 'text-gray-500'
          }`}
        >
          📱 聊天视图
        </button>
        <button
          onClick={() => setShowPanel(true)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            showPanel 
              ? 'text-primary-600 border-b-2 border-primary-500 bg-primary-50' 
              : 'text-gray-500'
          }`}
        >
          💻 消息流
        </button>
      </div>

      {/* 左侧手机框架 - 桌面端始终显示，移动端条件显示 */}
      <div className={`${showPanel ? 'hidden lg:flex' : 'flex'} lg:w-1/2 items-center justify-center p-4 lg:p-8 bg-gradient-to-br from-gray-200 to-gray-300 overflow-auto`}>
        {/* 移动端自适应尺寸 */}
        <div className="lg:hidden w-full max-w-[375px] mx-auto">
          <PhoneFrame
            messages={messages}
            permissionRequest={permissionRequest}
            selectionRequest={selectionRequest}
            summaryData={summaryData}
            onPermissionResponse={handlePermissionResponse}
            onSelectionResponse={handleSelectionResponse}
            onSendTask={sendTask}
            onReconnect={reconnect}
            connectionState={state}
          />
        </div>
        {/* 桌面端固定尺寸 */}
        <div className="hidden lg:block">
          <PhoneFrame
            messages={messages}
            permissionRequest={permissionRequest}
            selectionRequest={selectionRequest}
            summaryData={summaryData}
            onPermissionResponse={handlePermissionResponse}
            onSelectionResponse={handleSelectionResponse}
            onSendTask={sendTask}
            onReconnect={reconnect}
            connectionState={state}
          />
        </div>
      </div>

      {/* 右侧原始消息面板 - 桌面端始终显示，移动端条件显示 */}
      <div className={`${showPanel ? 'flex' : 'hidden lg:flex'} lg:w-1/2 lg:border-l border-gray-300 flex-col`}>
        <ProcessPanel messages={messages} connectionState={state} />
      </div>
    </div>
  )
}

export default App
