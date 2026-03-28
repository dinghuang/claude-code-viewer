// frontend/src/App.tsx
import { CopilotKit, useCoAgentStateRender } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { PhoneFrame } from "./components/PhoneFrame";
import { ProcessPanel } from "./components/ProcessPanel";
import { SystemPromptPanel, DEFAULT_PROMPT } from "./components/SystemPromptPanel";
import { useState, useEffect } from "react";

const RUNTIME_URL = (import.meta as any).env?.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000";
const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [showPanel, setShowPanel] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);

  // Sync default prompt to backend on mount
  useEffect(() => {
    fetch(`${API_URL}/api/system-prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: systemPrompt }),
    }).catch(() => {});
  }, []);

  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}
      agent="claude_code"
    >
      {/* System prompt editor — fixed bottom-left */}
      <SystemPromptPanel value={systemPrompt} onChange={setSystemPrompt} />

      <div className="flex flex-col lg:flex-row h-screen bg-gray-100">
        {/* 移动端顶部切换栏 */}
        <div className="lg:hidden flex bg-white border-b border-gray-200">
          <button
            onClick={() => setShowPanel(false)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              !showPanel
                ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50"
                : "text-gray-500"
            }`}
          >
            📱 聊天视图
          </button>
          <button
            onClick={() => setShowPanel(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              showPanel
                ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50"
                : "text-gray-500"
            }`}
          >
            💻 消息流
          </button>
        </div>

        {/* 左侧：手机框架 — shrink-0 保持手机宽度，不参与 flex 拉伸 */}
        <div
          className={`${
            showPanel ? "hidden lg:flex" : "flex"
          } shrink-0 items-center justify-center p-4 lg:p-6 bg-gradient-to-br from-gray-200 to-gray-300`}
        >
          <div className="lg:hidden w-full max-w-[375px] mx-auto">
            <PhoneFrame>
              <CopilotChatUI />
            </PhoneFrame>
          </div>
          <div className="hidden lg:block">
            <PhoneFrame>
              <CopilotChatUI />
            </PhoneFrame>
          </div>
        </div>

        {/* 右侧：思维过程面板 — flex-1 占满剩余空间 */}
        <div
          className={`${
            showPanel ? "flex" : "hidden lg:flex"
          } flex-1 min-w-0 lg:border-l border-gray-300 flex-col`}
        >
          <ProcessPanel />
        </div>
      </div>
    </CopilotKit>
  );
}

/** CopilotKit chat UI with permission state rendering */
function CopilotChatUI() {
  useCoAgentStateRender({
    name: "claude_code",
    render: (_args: any) => {
      return null;
    },
  });

  return (
    <CopilotChat
      instructions="你是一个 Claude Code 助手，帮助用户执行代码任务。"
      labels={{
        title: "Claude Code",
        initial: "有什么我可以帮你的？",
        placeholder: "输入你的问题...",
      }}
    />
  );
}
