// frontend/src/components/PhoneFrame.tsx
import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="relative">
      {/* 手机外框 */}
      <div className="w-[375px] h-[812px] bg-gray-900 rounded-[50px] p-3 shadow-2xl">
        {/* 屏幕 */}
        <div className="w-full h-full bg-white rounded-[38px] overflow-hidden relative flex flex-col">
          {/* 刘海 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 rounded-b-3xl z-10">
            <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-800 rounded-full" />
          </div>

          {/* 状态栏 */}
          <div className="h-12 bg-white flex items-center justify-between px-6 pt-3">
            <span className="text-xs font-medium text-gray-800">9:41</span>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.86 0-7-3.14-7-7s3.14-7 7-7 7 3.14 7 7-3.14 7-7 7z" />
              </svg>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
              </svg>
              <div className="flex items-center">
                <div className="w-6 h-3 border border-gray-600 rounded-sm relative">
                  <div className="absolute inset-0.5 bg-green-500 rounded-sm" style={{ width: "80%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* 应用标题栏 */}
          <div className="h-14 bg-primary-500 flex items-center justify-center">
            <h1 className="text-white text-lg font-semibold">Claude Code</h1>
          </div>

          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>

          {/* 底部指示条 */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  );
}
