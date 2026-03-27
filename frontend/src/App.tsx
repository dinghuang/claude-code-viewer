import { useState, useCallback } from 'react'
import { PhoneFrame } from './components/PhoneFrame'
import { ProcessPanel } from './components/ProcessPanel'
import { useWebSocket, Message, PermissionRequest, SelectionRequest, SummaryData } from './hooks/useWebSocket'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null)
  const [selectionRequest, setSelectionRequest] = useState<SelectionRequest | null>(null)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)

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

  const { sendResponse, isConnected } = useWebSocket(handleMessage)

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
    <div className="flex h-screen bg-gray-100">
      {/* 左侧手机框架 */}
      <div className="w-1/2 flex items-center justify-center p-8 bg-gradient-to-br from-gray-200 to-gray-300">
        <PhoneFrame
          messages={messages}
          permissionRequest={permissionRequest}
          selectionRequest={selectionRequest}
          summaryData={summaryData}
          onPermissionResponse={handlePermissionResponse}
          onSelectionResponse={handleSelectionResponse}
          isConnected={isConnected}
        />
      </div>

      {/* 右侧原始消息面板 */}
      <div className="w-1/2 border-l border-gray-300">
        <ProcessPanel messages={messages} isConnected={isConnected} />
      </div>
    </div>
  )
}

export default App
