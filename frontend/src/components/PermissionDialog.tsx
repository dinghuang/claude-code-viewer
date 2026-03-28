// frontend/src/components/PermissionDialog.tsx

interface ToolDenial {
  tool_name: string;
  tool_input: Record<string, any>;
  risk_level: "low" | "medium" | "high";
}

interface PermissionCardProps {
  denials: ToolDenial[];
  message: string;
  onRespond: (approved: boolean) => void;
}

export function PermissionCard({ denials, message, onRespond }: PermissionCardProps) {
  const riskConfig: Record<string, { color: string; label: string }> = {
    low: { color: "bg-green-100 text-green-700 border-green-200", label: "低风险" },
    medium: { color: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "中风险" },
    high: { color: "bg-red-100 text-red-700 border-red-200", label: "高风险" },
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden my-2 max-w-md">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-white font-semibold text-sm">{message}</h3>
        </div>
      </div>

      {/* Denied tools list */}
      <div className="p-4 space-y-2">
        {denials.map((d, i) => {
          const risk = riskConfig[d.risk_level] || riskConfig.medium;
          return (
            <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${risk.color}`}>
                  {risk.label}
                </span>
                <span className="text-sm font-medium text-gray-800">{d.tool_name}</span>
              </div>
              {d.tool_input && Object.keys(d.tool_input).length > 0 && (
                <pre className="text-xs text-gray-500 mt-1 overflow-x-auto max-h-20 whitespace-pre-wrap">
                  {JSON.stringify(d.tool_input, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {/* Buttons */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={() => onRespond(false)}
          className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
        >
          跳过
        </button>
        <button
          onClick={() => onRespond(true)}
          className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
        >
          允许并重试
        </button>
      </div>
    </div>
  );
}
