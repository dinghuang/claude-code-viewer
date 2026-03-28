# 2026-03-29 更新日志

## 设置面板优化

### 1. 左右布局重构

**之前**: 单一垂直布局（用户信息 + 系统提示词 + 权限设置）

**之后**: 左右分栏布局
```
┌─────────────────────────────────────────┬────────────────────┐
│  👤 用户信息                          │  🔐 权限设置         │
│  (上半部分 textarea)                    │  ○ 跳过所有权限      │
│                                        │  ○ 自动批准编辑      │
├────────────────────────────────────────┤  ○ 默认模式          │
│  📝 系统提示词                          │  ○ 计划模式          │
│  (下半部分 textarea)                    │                    │
└────────────────────────────────────────┴────────────────────┘
```

### 2. 弹窗尺寸增大

| 属性 | 之前 | 之后 |
|------|------|------|
| 宽度 | 900px | 1200px |
| 高度 | 90vh | 85vh (固定) |

### 3. 缓存策略优化

**问题**: 之前刷新页面会把空的 `DEFAULT_PROMPT` 发送到后端，覆盖文件

**修复**:

```typescript
// 之前（错误）: 挂载时把空字符串写入后端
useEffect(() => {
  fetch(`${API_URL}/api/system-prompt`, {
    method: "POST",
    body: JSON.stringify({ prompt: "" }),  // 空字符串！
  });
}, []);

// 之后（正确）: 挂载时从后端读取，不写入
useEffect(() => {
  fetch(`${API_URL}/api/system-prompt`)
    .then((r) => r.json())
    .then((data) => {
      if (data.prompt) setSystemPrompt(data.prompt);
    });
}, []);
```

### 4. 保存逻辑优化

**之前**: 保存时同时写入前端缓存和后端文件

**之后**: 保存时只写入前端 sessionStorage，不修改后端

```typescript
const handleSave = async () => {
  // 只保存到 session cache（不修改后端文件！）
  sessionStorage.setItem(CACHE_KEYS.userInfo, draftUserInfo);
  sessionStorage.setItem(CACHE_KEYS.systemPrompt, draftPrompt);
  sessionStorage.setItem(CACHE_KEYS.permissionMode, draftMode);

  onSystemPromptChange(combinedPrompt);
  onPermissionModeChange(draftMode);
};
```

### 5. 新增重置按钮

点击"重置"按钮 → 清除缓存 → 重新从后端获取模板

---

## 行为说明

| 操作 | 结果 |
|------|------|
| 刷新页面 | sessionStorage 被清空 → 从后端获取最新模板 |
| 打开设置面板 | 优先使用缓存，没有缓存才从后端获取 |
| 点击保存 | 只更新浏览器 sessionStorage |
| 点击重置 | 清除缓存，重新从后端获取 |
| 修改后端文件 | 刷新页面后前端获取最新内容 |

---

## MCP 配置简化

**之前**: 6 个 MCP 服务器（部分连接失败导致错误）

**之后**: 只保留 webresearch

```json
CLAUDE_CODE_MCP_SERVERS={"webresearch":{"command":"npx","args":["-y","@mzxrai/mcp-webresearch@latest"]}}
```

---

## 文件变更

| 文件 | 变更 |
|------|------|
| `frontend/src/App.tsx` | 移除自动 POST，改为 GET 获取 |
| `frontend/src/components/SystemPromptPanel.tsx` | 左右布局、缓存优化、保存逻辑 |
| `backend/.env` | 简化 MCP 配置 |
