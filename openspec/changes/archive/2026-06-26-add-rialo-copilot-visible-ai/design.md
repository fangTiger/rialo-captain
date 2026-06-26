## Context

Rialo Captain 当前用 FastAPI 后端、Vite React 前端和 cookie JWT 鉴权提供航班延误险体验。产品已有实时大屏、航班详情、保单、赔付和证据回放，但用户需要自己读多个页面才能理解风险、赔付原因和证据链。

DeepSeek V4 官方 API 提供 OpenAI-compatible chat completions，模型包含 `deepseek-v4-flash` 与 `deepseek-v4-pro`，支持长上下文、JSON output、tool calls 和 reasoning 配置。本变更使用服务端 HTTP client 调用 DeepSeek V4，前端只调用 Rialo 后端 API。

## Goals / Non-Goals

**Goals:**

- 让用户在主导航和核心页面明显看到 AI 能力。
- 用 DeepSeek V4 生成基于当前产品数据的解释、风险摘要、证据链解读和追问建议。
- 保证回答带来源引用，不把模型输出当作保单或赔付的真实状态。
- 服务端持有 DeepSeek 密钥，遵守当前 cookie JWT 鉴权和用户数据边界。
- 未配置密钥、模型超时或网络失败时提供清晰降级体验。

**Non-Goals:**

- 不引入 AI 自动买险、自动改保单、自动审批赔付。
- 不做长期聊天记忆或跨会话会话存储。
- 不把完整数据库、JWT、cookie、密钥或后台运行状态发送给外部模型。
- 不替换现有 SearchPalette、ClaimEngine 或 EvidenceReplay 的确定性逻辑。

## Decisions

### Decision 1: 新增 `rialo-copilot` capability 和 `/copilot/ask`

后端新增 `backend/copilot` 模块，包含 schemas、context builder、provider 和 routes。API 使用 `POST /copilot/ask`，请求携带 subject 类型与 subject id，例如 `overview`、`flight`、`policy`、`claim`、`evidence`。返回结构化 answer、sources、suggested_prompts 和 status。

Rationale: Copilot 是产品级能力，不属于单个页面，也不应混在 claims 或 evidence router 中。独立 capability 便于安全审查、测试和后续替换模型。

Alternative considered: 直接在前端调用 DeepSeek。拒绝，因为会暴露 API key，且无法可靠执行用户数据边界。

### Decision 2: 服务端上下文构建先于模型调用

`CopilotContextBuilder` 只从当前用户可见的数据创建紧凑上下文：当前用户、航班摘要、关联保单、关联赔付、证据事件和关键指标。上下文使用白名单字段，避免发送 cookie、JWT、密钥、原始异常、无关用户邮箱或完整日志。

Rationale: 模型质量来自可信上下文，安全性来自最小化数据发送。上下文先结构化再提示，可让测试验证数据边界。

Alternative considered: 把页面当前 JSON 原样传给后端。拒绝，因为前端状态不可信，且容易泄漏无关字段。

### Decision 3: DeepSeek V4 provider 使用服务端 HTTP client

默认模型使用 `DEEPSEEK_MODEL=deepseek-v4-pro`，base URL 默认 `https://api.deepseek.com`，并通过 `DEEPSEEK_API_KEY` 启用真实调用。provider 使用 OpenAI-compatible `/chat/completions`，要求 JSON object 输出，解析失败时返回可恢复错误。

Rationale: 直接 HTTP client 避免引入额外 SDK 依赖，并与当前 FastAPI/httpx 风格一致。`deepseek-v4-pro` 更适合解释证据链和复杂赔付原因，后续可通过环境变量降级到 `deepseek-v4-flash`。

Alternative considered: 固定 `deepseek-v4-flash`。拒绝作为默认，因为本次目标是让 AI 效果明显，解释质量优先于最低成本。

### Decision 4: 前端用全局 Copilot drawer + 上下文入口

在 `AppShell` 下挂载 `RialoCopilotProvider` 和 `RialoCopilotPanel`。`TopNav` 显示 `Ask Rialo` 主入口；Tower 首页展示 `AI Briefing`；FlightDetail、MyHangar、ClaimsFeed、EvidenceDrawer 提供上下文 prompt chips。所有入口复用同一 panel 状态和请求 hook。

Rationale: 用户既能第一眼看到 AI，也能在具体场景中一键发问。全局 panel 避免每个页面重复实现请求、loading、错误和引用展示。

Alternative considered: 新增独立 `/copilot` 页面。暂不采用，因为用户希望 AI 更显眼，独立页面会把能力藏到导航深处。

### Decision 5: 回答必须带引用和边界提示

模型响应必须包含 `summary`、`answer`、`sources`、`suggested_prompts`、`confidence`。前端渲染引用来源，例如 Flight、Policy、Claim、EvidenceEvent。回答区域固定显示“AI uses current Rialo data; final settlement remains deterministic”的边界提示。

Rationale: 产品是保险和赔付场景，用户需要知道回答基于哪些证据，也需要明白 AI 不是赔付裁判。

Alternative considered: 展示自由文本聊天。拒绝，因为难以测试、难以引用、也不利于安全审查。

## Risks / Trade-offs

- [Risk] DeepSeek key 未配置导致功能不可用 -> 后端返回结构化 unavailable，前端展示“AI 暂未接通”并保留入口。
- [Risk] 模型幻觉或过度承诺 -> 强制来源引用、系统提示边界、前端免责声明，不允许模型修改业务状态。
- [Risk] 外部 API 延迟影响体验 -> 设置超时、loading skeleton、允许用户关闭 drawer，失败不影响原页面。
- [Risk] 用户数据泄漏 -> 后端鉴权、subject ownership 校验、上下文字段白名单、测试覆盖跨用户访问。
- [Risk] JSON 响应解析失败 -> provider 对解析失败做错误映射，UI 走可恢复错误态。

## Migration Plan

1. 添加 Copilot 后端模块、配置和路由，默认未配置 key 时返回不可用。
2. 添加前端 Copilot provider/panel/briefing 和各页面入口。
3. 补齐后端、前端单测和浏览器冒烟测试。
4. 部署时在服务端设置 `DEEPSEEK_API_KEY`，按需设置 `DEEPSEEK_MODEL`。
5. 回滚时移除前端入口或关闭服务端 key；核心保险流程不受影响。

## Open Questions

- 第一版是否需要区分“快速问答”和“深度分析”两档模型开关？本设计先用单一模型配置，后续可扩展。
- 是否需要把用户提问和回答落库用于审计？第一版不存储，避免引入隐私和数据保留复杂度。
