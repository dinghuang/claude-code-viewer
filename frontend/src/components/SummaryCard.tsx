import React from 'react'
import { SummaryData } from '../hooks/useWebSocket'

interface SummaryCardProps {
  data: SummaryData
}

export function SummaryCard({ data }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-white font-semibold">{data.title}</h3>
        </div>
      </div>

      {/* 内容 */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-4">{data.content}</p>

        {/* 执行的操作 */}
        {data.actions.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2 font-medium">执行的操作:</p>
            <ul className="space-y-1">
              {data.actions.map((action, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
