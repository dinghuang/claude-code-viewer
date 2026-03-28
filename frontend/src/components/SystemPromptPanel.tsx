import { useState } from "react";

const DEFAULT_PROMPT = `# Claude Code Viewer 助手

你是一个 Claude Code 助手，帮助用户执行代码任务。

## 工作模式

- 使用 Read 工具先了解项目结构
- 使用 Glob 和 Grep 搜索相关文件
- 使用 Edit 工具修改代码
- 使用 Bash 工具执行命令

## 权限策略

- 读取操作：自动批准
- 编辑操作：需要用户确认
- 执行命令：高风险，需要用户明确确认

## 响应格式

1. 先说明你要做什么
2. 展示关键代码或命令
3. 等待用户确认后执行
4. 执行后汇报结果

## 注意事项

- 不要删除文件，除非用户明确要求
- 执行命令前先解释命令的作用
- 保持代码风格一致`;

const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

const PERMISSION_MODES = [
  { value: "bypassPermissions", label: "跳过所有权限", desc: "自动批准所有操作" },
  { value: "acceptEdits", label: "自动批准编辑", desc: "文件编辑自动批准，其他需确认" },
  { value: "default", label: "默认模式", desc: "按 Claude Code 默认权限策略" },
  { value: "plan", label: "计划模式", desc: "先展示计划，确认后执行" },
];

interface SettingsPanelProps {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
}

export function SettingsPanel({
  systemPrompt,
  onSystemPromptChange,
  permissionMode,
  onPermissionModeChange,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);
  const [draftMode, setDraftMode] = useState(permissionMode);
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    setDraftPrompt(systemPrompt);
    setDraftMode(permissionMode);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch(`${API_URL}/api/system-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: draftPrompt }),
        }),
        fetch(`${API_URL}/api/permission-mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: draftMode }),
        }),
      ]);
      onSystemPromptChange(draftPrompt);
      onPermissionModeChange(draftMode);
      setOpen(false);
    } catch (e) {
      console.error("Failed to save settings:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating gear button — bottom-left */}
      <button
        onClick={handleOpen}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        title="设置"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">设置</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-4 overflow-auto space-y-5">
              {/* Permission Mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">权限模式</label>
                <div className="space-y-2">
                  {PERMISSION_MODES.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        draftMode === m.value
                          ? "bg-blue-50 border-blue-300"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="permMode"
                        value={m.value}
                        checked={draftMode === m.value}
                        onChange={() => setDraftMode(m.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{m.label}</div>
                        <div className="text-xs text-gray-500">{m.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">系统提示词</label>
                  <button
                    onClick={() => setDraftPrompt(DEFAULT_PROMPT)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    恢复默认
                  </button>
                </div>
                <textarea
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  className="w-full h-[300px] p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入系统提示词..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { DEFAULT_PROMPT };
