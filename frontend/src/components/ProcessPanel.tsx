// frontend/src/components/ProcessPanel.tsx
import { useEffect, useRef } from "react";
import { useProcessStream } from "../hooks/useProcessStream";
import type { ProcessMessage } from "../types/messages";

export function ProcessPanel() {
  const { messages, isConnected, clearMessages } = useProcessStream();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [messages]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h2 className="font-semibold text-gray-200">思维过程</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-xs text-gray-400">
              {isConnected ? "已连接" : "未连接"}
            </span>
          </div>
          <button
            onClick={clearMessages}
            className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            清空
          </button>
        </div>
      </div>

      {/* 消息列表 */}
      <div ref={panelRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <svg
              className="w-16 h-16 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <p className="text-sm">等待 Claude 思考...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ProcessMessageBlock key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
        <span>共 {messages.length} 条消息</span>
      </div>
    </div>
  );
}

/** Process message block component */
function ProcessMessageBlock({ message }: { message: ProcessMessage }) {
  const getBlockStyle = () => {
    switch (message.type) {
      case "thinking":
        return "bg-gray-800 border-gray-700";
      case "tool_use":
        return "bg-blue-900/30 border-blue-700";
      case "tool_result":
        return "bg-green-900/30 border-green-700";
      case "permission":
        return "bg-yellow-900/30 border-yellow-700";
      case "result":
        return "bg-purple-900/30 border-purple-700";
      case "error":
        return "bg-red-900/30 border-red-700";
      default:
        return "bg-gray-800 border-gray-700";
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case "thinking":
        return "💭";
      case "tool_use":
        return "⚙️";
      case "tool_result":
        return "✓";
      case "permission":
        return "🔒";
      case "result":
        return "✨";
      case "error":
        return "❌";
      default:
        return "📝";
    }
  };

  const getLabel = () => {
    switch (message.type) {
      case "thinking":
        return "思考";
      case "tool_use":
        return "工具调用";
      case "tool_result":
        return "工具结果";
      case "permission":
        return "权限请求";
      case "result":
        return "任务完成";
      case "error":
        return "错误";
      default:
        return "文本";
    }
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${getBlockStyle()}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{getIcon()}</span>
          <span className="text-xs text-gray-400">{getLabel()}</span>
          {message.risk_level && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                message.risk_level === "high"
                  ? "bg-red-600"
                  : message.risk_level === "medium"
                  ? "bg-yellow-600"
                  : "bg-green-600"
              }`}
            >
              {message.risk_level}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* 内容 */}
      <p className="text-gray-200 whitespace-pre-wrap break-words">
        {message.content}
      </p>

      {/* 工具详情 */}
      {message.tool_name && (
        <div className="mt-2">
          <span className="text-xs text-blue-400 font-medium">
            {message.tool_name}
          </span>
        </div>
      )}

      {/* 工具输入 */}
      {message.tool_input && (
        <pre className="mt-2 text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto">
          {JSON.stringify(message.tool_input, null, 2)}
        </pre>
      )}

      {/* 工具结果 */}
      {message.tool_result && (
        <pre className="mt-2 text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto max-h-40">
          {typeof message.tool_result === "string"
            ? message.tool_result
            : JSON.stringify(message.tool_result, null, 2)}
        </pre>
      )}

      {/* 操作列表 */}
      {message.actions && message.actions.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-gray-400">执行的操作:</span>
          <ul className="mt-1 space-y-1">
            {message.actions.map((action, idx) => (
              <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 费用 */}
      {message.cost !== undefined && message.cost !== null && (
        <div className="mt-2 text-xs text-gray-400 flex justify-end">
          费用: ${message.cost.toFixed(4)}
        </div>
      )}
    </div>
  );
}
