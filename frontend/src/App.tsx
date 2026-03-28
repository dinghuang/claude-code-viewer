// frontend/src/App.tsx
import { CopilotKit, useCoAgentStateRender } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { useLangGraphInterrupt } from "@copilotkit/react-core";
import { PhoneFrame } from "./components/PhoneFrame";
import { ProcessPanel } from "./components/ProcessPanel";
import { PermissionCard } from "./components/PermissionDialog";
import { SettingsPanel } from "./components/SystemPromptPanel";
import { useState, useEffect, useRef } from "react";

const RUNTIME_URL = (import.meta as any).env?.VITE_COPILOTKIT_RUNTIME_URL || "http://localhost:4000";
const API_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

// Stable thread ID — persists until page refresh, ensures session reuse
const SESSION_THREAD_ID = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function App() {
  const [showPanel, setShowPanel] = useState(false);
  const [userInfo, setUserInfo] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [permissionMode, setPermissionMode] = useState("bypassPermissions");
  // Defaults from backend files — used for "restore default" buttons
  const [defaultUserInfo, setDefaultUserInfo] = useState("");
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState("");
  const initialized = useRef(false);

  // Fetch user_info and system_prompt from backend files on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    Promise.all([
      fetch(`${API_URL}/api/user-info`).then((r) => r.json()),
      fetch(`${API_URL}/api/system-prompt`).then((r) => r.json()),
    ])
      .then(([infoRes, promptRes]) => {
        const info = infoRes.content || "";
        const prompt = promptRes.prompt || "";
        setUserInfo(info);
        setSystemPrompt(prompt);
        setDefaultUserInfo(info);
        setDefaultSystemPrompt(prompt);

        // Send combined prompt + permission mode to backend
        const combined = [info, prompt].filter(Boolean).join("\n\n---\n\n");
        return Promise.all([
          fetch(`${API_URL}/api/system-prompt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: combined }),
          }),
          fetch(`${API_URL}/api/permission-mode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: permissionMode }),
          }),
        ]);
      })
      .catch((e) => console.error("Failed to fetch settings:", e));
  }, []);

  return (
    <CopilotKit
      runtimeUrl={`${RUNTIME_URL}/copilotkit`}
      agent="claude_code"
      threadId={SESSION_THREAD_ID}
    >
      {/* Settings panel — bottom-left gear */}
      <SettingsPanel
        userInfo={userInfo}
        onUserInfoChange={setUserInfo}
        systemPrompt={systemPrompt}
        onSystemPromptChange={setSystemPrompt}
        permissionMode={permissionMode}
        onPermissionModeChange={setPermissionMode}
        defaultUserInfo={defaultUserInfo}
        defaultSystemPrompt={defaultSystemPrompt}
      />

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

/** CopilotKit chat UI with permission interrupt rendering */
function CopilotChatUI() {
  useCoAgentStateRender({
    name: "claude_code",
    render: (_args: any) => {
      return null;
    },
  });

  // Render permission cards when LangGraph interrupts for permission denials
  useLangGraphInterrupt({
    enabled: ({ eventValue }: any) => {
      return eventValue?.type === "permission_request";
    },
    render: ({ event, resolve }: any) => {
      const value = event?.value || event || {};
      return (
        <PermissionCard
          denials={value.denials || []}
          message={value.message || "权限请求"}
          onRespond={(approved: boolean) => {
            resolve(JSON.stringify({ approved }));
          }}
        />
      );
    },
  });

  return (
    <CopilotChat
      instructions="你是一个 AI智能投顾，帮助用户解决投资问题。"
      labels={{
        title: "AI智能投顾",
        initial: "您好，我是您的AI智能投顾，有什么我可以帮你的？",
        placeholder: "输入你的问题...",
      }}
    />
  );
}
