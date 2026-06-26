# Rialo Copilot Visible AI 实施计划

## 目标

把 DeepSeek V4 能力做成用户能明显感知的 Rialo Copilot：全局可见入口、Tower AI Briefing、上下文 prompt chips、后端受保护问答端点，以及可测试的数据边界和降级体验。

## 分工

- 主 Agent：维护 OpenSpec、计划、任务拆分、验收和协调。
- worker：按计划实现后端与前端代码，遵循 TDD。
- reviewer：对 worker 结果做代码审查，重点检查安全边界、规范符合度、测试和 UX。

## 阶段

### 1. Proposal and Spec

- 创建 `add-rialo-copilot-visible-ai` OpenSpec 变更。
- 补齐 proposal、design、spec delta、tasks。
- 运行 OpenSpec 状态检查，确认提案可进入实现。

### 2. Backend TDD

- 先写 Copilot API、上下文构建、provider 降级和鉴权隔离测试。
- 实现 `backend/copilot` 模块与 `/copilot/ask` router。
- 添加 DeepSeek V4 配置，默认未配置 key 时返回 unavailable。

### 3. Frontend TDD

- 先写 Copilot panel、TopNav entry、AI Briefing、context prompt chips 的测试。
- 实现全局 Copilot provider、hook、panel 和各页面入口。
- 确认 `/login` 不显示 AI 入口，provider unavailable 状态可见。

### 4. Review and Verification

- reviewer 审查 worker diff。
- 修复审查问题。
- 运行后端测试、前端测试、构建或类型检查。
- 启动本地服务并用浏览器验证 dev login、Ask Rialo 和降级态。
