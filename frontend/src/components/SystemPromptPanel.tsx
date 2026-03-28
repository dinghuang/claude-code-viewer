import { useState } from "react";

const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

const PERMISSION_MODES = [
  { value: "bypassPermissions", label: "跳过所有权限", desc: "自动批准所有操作" },
  { value: "acceptEdits", label: "自动批准编辑", desc: "文件编辑自动批准，其他需确认" },
  { value: "default", label: "默认模式", desc: "按 Claude Code 默认权限策略" },
  { value: "plan", label: "计划模式", desc: "先展示计划，确认后执行" },
];

interface SettingsPanelProps {
  userInfo: string;
  onUserInfoChange: (info: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  permissionMode: string;
  onPermissionModeChange: (mode: string) => void;
  defaultUserInfo: string;
  defaultSystemPrompt: string;
}

export function SettingsPanel({
  userInfo,
  onUserInfoChange,
  systemPrompt,
  onSystemPromptChange,
  permissionMode,
  onPermissionModeChange,
  defaultUserInfo,
  defaultSystemPrompt,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [draftUserInfo, setDraftUserInfo] = useState(userInfo);
  const [draftPrompt, setDraftPrompt] = useState(systemPrompt);
  const [draftMode, setDraftMode] = useState(permissionMode);
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    setDraftUserInfo(userInfo);
    setDraftPrompt(systemPrompt);
    setDraftMode(permissionMode);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Concatenate user info + system prompt, send combined as system prompt to backend
      const combined = [draftUserInfo, draftPrompt].filter(Boolean).join("\n\n---\n\n");
      await Promise.all([
        fetch(`${API_URL}/api/system-prompt`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: combined }),
        }),
        fetch(`${API_URL}/api/permission-mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: draftMode }),
        }),
      ]);
      // Save to frontend cache only
      onUserInfoChange(draftUserInfo);
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
          <div className="bg-white rounded-2xl shadow-2xl w-[1200px] max-w-[95vw] h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">设置</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content — left-right layout */}
            <div className="flex-1 flex min-h-0">
              {/* Left: User Info + System Prompt */}
              <div className="flex-1 flex flex-col min-w-0 px-6 py-4 overflow-auto">
                {/* User Info */}
                <div className="flex flex-col flex-1 min-h-0 mb-4">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <label className="block text-sm font-medium text-gray-700">用户信息</label>
                    <button
                      onClick={() => setDraftUserInfo(defaultUserInfo)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      恢复默认
                    </button>
                  </div>
                  <textarea
                    value={draftUserInfo}
                    onChange={(e) => setDraftUserInfo(e.target.value)}
                    className="w-full flex-1 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入用户信息..."
                  />
                </div>

                {/* System Prompt */}
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <label className="block text-sm font-medium text-gray-700">系统提示词</label>
                    <button
                      onClick={() => setDraftPrompt(defaultSystemPrompt)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      恢复默认
                    </button>
                  </div>
                  <textarea
                    value={draftPrompt}
                    onChange={(e) => setDraftPrompt(e.target.value)}
                    className="w-full flex-1 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入系统提示词..."
                  />
                </div>
              </div>

              {/* Right: Permission Mode */}
              <div className="w-[280px] shrink-0 border-l border-gray-200 px-5 py-4 overflow-auto">
                <label className="block text-sm font-medium text-gray-700 mb-3">权限设置</label>
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
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 shrink-0">
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
