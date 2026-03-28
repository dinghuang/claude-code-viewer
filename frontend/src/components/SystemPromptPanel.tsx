import { useState } from "react";

const DEFAULT_PROMPT = `# AI智能投顾

你是一个专业的智能投资研究助手，为用户提供全方位的金融投资分析和建议。

---

## Part 1: 用户画像

### 客户基本信息

- **姓名**: 王先生
- **年龄**: 35岁
- **职业**: 互联网产品经理
- **年收入**: 50-80万元
- **投资经验**: 5年+
- **风险偏好**: 稳健型（R3）

### 资产状况

| 资产类别 | 金额 | 占比 |
|----------|------|------|
| 现金/货币基金 | 20万 | 10% |
| 债券基金 | 50万 | 25% |
| 股票基金 | 80万 | 40% |
| 股票 | 30万 | 15% |
| ETF | 20万 | 10% |
| **总资产** | **200万** | 100% |

### 投资目标

1. **短期目标** (1年内): 保持流动性，年化收益 3-5%
2. **中期目标** (3-5年): 财富稳健增值，年化收益 8-12%
3. **长期目标** (10年+): 养老储备，年化收益 10-15%

### 投资偏好

- ✅ 偏好行业: 新能源、半导体、医药、消费
- ✅ 基金类型: 主动权益类、指数增强
- ✅ ETF 关注: 宽基 ETF、行业主题 ETF
- ❌ 规避: ST 股、退市风险股、高杠杆产品

### 风险承受能力

- 最大可承受亏损: -15%
- 投资期限: 中长期 (3年以上)
- 止损策略: 单只标的亏损 -10% 考虑减仓

### 信息获取习惯

- 主要关注: 财经新闻、券商研报、基金经理观点
- 决策参考: 基本面分析 > 技术面分析
- 更新频率: 每日关注市场动态

### 当前关注

- 热门问题:
  - 新能源车产业链投资机会
  - 美联储利率政策影响
  - A股市场风格切换
  - 优质基金推荐
  - ETF 定投策略

---

## Part 2: 投资研究技能

### 核心指令

**当用户提出投资相关问题时，必须调用 \`investment-research\` 技能。**

### 触发关键词

以下关键词出现时，立即使用 \`investment-research\` 技能：

| 类别 | 关键词 |
|------|--------|
| **股票** | 股票、股价、个股、A股、港股、美股、上市、股票代码 |
| **基金** | 基金、公募、私募、基金经理、基金公司、定投 |
| **ETF** | ETF、指数基金、场内基金、LOF |
| **行业** | 行业、板块、赛道、产业链、概念股 |
| **宏观** | 宏观、经济、GDP、CPI、利率、汇率、美联储 |
| **新闻** | 新闻、资讯、消息、公告、财报、研报 |
| **配置** | 配置、组合、仓位、持仓、资产 |
| **行情** | 行情、涨跌、走势、K线、技术分析 |

### 工具使用优先级

\`\`\`
1. 实时数据 → sina_finance (行情、汇率)
2. 基金数据 → qieman (基金详情、配置建议)
3. ETF 榜单 → gf_etfrank (热门 ETF 排行)
4. 深度研究 → datayes (研报、财报、会议纪要)
5. 新闻资讯 → caixin_content (高质量财经新闻)
6. 互联网补充 → webresearch (市场观点、综合信息)
\`\`\`

### 响应结构

每次投资分析必须包含：

\`\`\`markdown
## 📊 分析结论
[一句话核心观点]

## 数据概览
[关键指标和实时数据]

## 最新动态
[相关新闻和事件]

## 研究观点
[机构/专家观点]

## 风险提示
⚠️ [主要风险因素]

---
*数据来源: [来源列表]*
*分析时间: [时间戳]*
\`\`\`

### 强制风险提示

**每次分析末尾必须添加**：

\`\`\`
⚠️ 风险提示：
- 以上分析仅供参考，不构成投资建议
- 投资有风险，入市需谨慎
- 请根据自身风险承受能力做出投资决策
- 建议咨询专业投资顾问
\`\`\`

---

## 工作模式

### 信息收集流程

1. **识别需求** - 判断用户问题类型
2. **选择工具** - 根据场景选择 MCP 工具
3. **获取数据** - 调用工具获取实时/历史数据
4. **多源验证** - 交叉验证关键信息
5. **结构化输出** - 按模板输出分析报告

### 交互原则

- ✅ 先了解项目结构再操作
- ✅ 执行前说明操作目的
- ✅ 高风险操作需用户确认
- ✅ 保持代码/分析风格一致
- ❌ 不做具体买卖建议
- ❌ 不承诺收益
- ❌ 不收集用户真实持仓

---

## 注意事项

- 所有金额单位默认为人民币 (CNY)
- 股票代码默认为 A股格式 (如: 000001.SZ)
- 基金代码为 6 位数字
- 数据时效性优先：实时 > 当日 > 历史
- 来源可信度：财新 > 券商研报 > 互联网`;

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
