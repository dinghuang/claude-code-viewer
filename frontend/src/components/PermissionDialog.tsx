import React from 'react'
import { PermissionRequest } from '../hooks/useWebSocket'

interface PermissionDialogProps {
  request: PermissionRequest
  onResponse: (approved: boolean) => void
}

export function PermissionDialog({ request, onResponse }: PermissionDialogProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'low':
        return '低风险'
      case 'medium':
        return '中风险'
      case 'high':
        return '高风险'
      default:
        return '未知'
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-white font-semibold">{request.title}</h3>
        </div>
      </div>

      {/* 内容 */}
      <div className="p-4">
        {/* 风险等级 */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRiskColor(request.riskLevel)}`}>
            {getRiskLabel(request.riskLevel)}
          </span>
          <span className="text-xs text-gray-500">工具: {request.toolName}</span>
        </div>

        {/* 描述 */}
        <p className="text-sm text-gray-600 mb-4">{request.description}</p>

        {/* 按钮 */}
        <div className="flex gap-2">
          <button
            onClick={() => onResponse(false)}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            拒绝
          </button>
          <button
            onClick={() => onResponse(true)}
            className="flex-1 py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
          >
            允许
          </button>
        </div>
      </div>
    </div>
  )
}
