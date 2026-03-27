import React, { useState } from 'react'
import { SelectionRequest } from '../hooks/useWebSocket'

interface SelectionCardProps {
  request: SelectionRequest
  onSelect: (selectedOption: string) => void
}

export function SelectionCard({ request, onSelect }: SelectionCardProps) {
  const [selected, setSelected] = useState<string[]>([])

  const handleToggle = (option: string) => {
    if (request.multiSelect) {
      setSelected(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      )
    } else {
      setSelected([option])
    }
  }

  const handleConfirm = () => {
    if (selected.length > 0) {
      onSelect(request.multiSelect ? selected.join(',') : selected[0])
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-white font-semibold">{request.title}</h3>
        </div>
      </div>

      {/* 选项列表 */}
      <div className="p-4 space-y-2">
        {request.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleToggle(option)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              selected.includes(option)
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 ${request.multiSelect ? 'rounded-md' : 'rounded-full'} border-2 flex items-center justify-center transition-colors ${
                  selected.includes(option)
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-gray-300'
                }`}
              >
                {selected.includes(option) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="flex-1">{option}</span>
            </div>
          </button>
        ))}

        {/* 确认按钮 */}
        <button
          onClick={handleConfirm}
          disabled={selected.length === 0}
          className={`w-full py-3 rounded-xl font-medium transition-colors ${
            selected.length > 0
              ? 'bg-primary-500 hover:bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          确认选择
        </button>
      </div>
    </div>
  )
}
