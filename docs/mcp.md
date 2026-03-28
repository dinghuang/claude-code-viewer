# MCP 服务器配置

本文档记录 AI智能投顾 后端配置的 MCP (Model Context Protocol) 服务器。

---

## 配置位置

MCP 服务器配置位于 `backend/.env` 文件中的 `CLAUDE_CODE_MCP_SERVERS` 环境变量。

```bash
CLAUDE_CODE_MCP_SERVERS={"webresearch":{...},"qieman":{...},...}
```

---

## 已配置的 MCP 服务器

### 1. WebResearch - 网页研究工具

**用途**: 谷歌搜索、网页内容提取、截图

| 功能 | 说明 |
|------|------|
| Google 搜索 | 搜索互联网获取最新信息 |
| 网页访问 | 提取网页内容 |
| 截图 | 网页截图功能 |

**配置**:
```json
{
  "webresearch": {
    "command": "npx",
    "args": ["-y", "@mzxrai/mcp-webresearch@latest"]
  }
}
```

**可用工具**:
- `mcp__webresearch__search_google` - Google 搜索
- `mcp__webresearch__visit_page` - 访问网页并提取内容
- `mcp__webresearch__take_screenshot` - 截取网页截图

---

### 2. Qieman - 盈米且慢财富管理

**用途**: 专业金融数据与投顾服务

| 板块 | 功能 |
|------|------|
| 金融数据 | 财富管理数据体系，准确及时的数据基础 |
| 投顾内容 | 盈米研究院市场分析、投教资源 |
| 投研服务 | 资产研究、投研观点、产品对比、基金组合模拟 |
| 投顾服务 | 资金规划、资产配置引擎、持仓诊断 |
| 通用服务 | PDF 报告生成、金融图表可视化 |

**配置**:
```json
{
  "qieman": {
    "url": "https://stargate.yingmi.com/mcp/v2",
    "headers": {
      "x-api-key": "your_api_key",
      "Accept": "application/json, text/event-stream"
    }
  }
}
```

---

### 3. Caixin Content - 财新新闻搜索

**用途**: 获取财新新闻内容，可信可引用的高质量新闻源

**特点**:
- 高质量新闻内容
- 可信来源
- 支持引用

**配置**:
```json
{
  "caixin_content": {
    "url": "https://appai.caixin.com/mcpsse/sse?token=your_token"
  }
}
```

---

### 4. Sina Finance - 新浪财经

**用途**: 24小时金融助手，实时汇率报价

**特点**:
- 实时金融数据
- 汇率报价
- 24小时更新

**配置**:
```json
{
  "sina_finance": {
    "url": "https://mcp.finance.sina.com.cn/mcp-http"
  }
}
```

---

### 5. GF ETFRank - 广发 ETF 榜单

**用途**: 沪深市场 ETF 热点排行

| 榜单类型 | 维度 |
|----------|------|
| 涨跌榜 | 涨跌幅排行 |
| 资金榜 | 资金流向排行 |
| 特色榜 | 13个维度统计市场热点 |

**配置**:
```json
{
  "gf_etfrank": {
    "url": "https://mcp-api.gf.com.cn/server/mcp/etf_rank/mcp",
    "headers": {
      "Authorization": "Bearer your_token"
    }
  }
}
```

---

### 6. Datayes - 萝卜投研 AI 搜索

**用途**: 智能投研搜索引擎

| 数据类型 | 来源 |
|----------|------|
| 研报 | 券商研报 |
| 财报 | 上市公司财报 |
| 会议纪要 | 公司会议记录 |
| 公告 | 交易所公告 |
| 资讯 | 媒体报道 |

**覆盖维度**:
- 股票：个股深度分析
- 行业：产业链分析
- 基金：产品评价及深度分析
- 宏观：宏观经济分析

**配置**:
```json
{
  "datayes": {
    "url": "https://mcp.datayes.com/ai/mcp/",
    "headers": {
      "Authorization": "your_token"
    }
  }
}
```

---

## 使用场景

### 场景1: 市场研究
```
1. 使用 caixin_content 获取最新财经新闻
2. 使用 sina_finance 查询实时汇率
3. 使用 datayes 搜索相关研报
```

### 场景2: ETF 投资
```
1. 使用 gf_etfrank 查看热门 ETF 榜单
2. 使用 qieman 进行基金分析
3. 使用 datayes 搜索行业研报
```

### 场景3: 投顾服务
```
1. 使用 qieman 获取资产配置建议
2. 使用 webresearch 搜索市场观点
3. 使用 qieman 生成 PDF 报告
```

---

## 配置格式说明

### stdio 类型 (本地命令)
```json
{
  "server_name": {
    "command": "npx",
    "args": ["-y", "package-name"]
  }
}
```

### HTTP/SSE 类型 (远程服务)
```json
{
  "server_name": {
    "url": "https://api.example.com/mcp",
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
```

---

## 环境变量完整示例

```bash
# backend/.env

# ============ MCP 服务器配置 ============
CLAUDE_CODE_MCP_SERVERS={"webresearch":{"command":"npx","args":["-y","@mzxrai/mcp-webresearch@latest"]},"qieman":{"url":"https://stargate.yingmi.com/mcp/v2","headers":{"x-api-key":"your_key","Accept":"application/json, text/event-stream"}},"caixin_content":{"url":"https://appai.caixin.com/mcpsse/sse?token=your_token"},"sina_finance":{"url":"https://mcp.finance.sina.com.cn/mcp-http"},"gf_etfrank":{"url":"https://mcp-api.gf.com.cn/server/mcp/etf_rank/mcp","headers":{"Authorization":"Bearer your_token"}},"datayes":{"url":"https://mcp.datayes.com/ai/mcp/","headers":{"Authorization":"your_token"}}}
```

---

## 注意事项

1. **API Key 安全**: 不要将真实的 API Key 提交到版本控制系统
2. **Token 过期**: 部分 Token 可能有过期时间，需要定期更新
3. **网络依赖**: 远程 MCP 服务需要网络连接
4. **重启生效**: 修改 `.env` 后需要重启后端服务

---

## 更新日志

| 日期 | 变更 |
|------|------|
| 2026-03-29 | 初始配置，添加 6 个 MCP 服务器 |
