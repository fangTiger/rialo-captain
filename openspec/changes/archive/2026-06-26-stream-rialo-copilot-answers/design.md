## Context

Rialo 现在已有 `POST /copilot/ask`：后端构建白名单上下文，调用 DeepSeek V4，并要求模型一次性返回 JSON。前端 `CopilotProvider` 等完整响应回来后才更新面板。这个方案安全，但用户在等待期间看不到任何增量反馈；如果模型输出不满足 JSON 约定，还会整体降级为 unavailable。

本地验证还暴露了一个产品问题：未买保单的新用户打开 Tower 时能看到 300 条 mock live flights，但 Copilot overview 只基于用户已有 policies/claims/events 构建上下文，因此会回答“当前没有航班/没有风险”。这不是 DeepSeek key 问题，而是产品上下文喂得不完整。

`arc-lepton` research 的可复用经验是：后端把 Agent 进度抽象成事件，SSE 输出事件流；前端订阅后累积 `report_chunk` 并实时渲染。Rialo 不需要完整 research job/replay/cancel 架构，但可以复用“事件类型 + 增量文本 + 终态事件”的交互模型。

## Goals / Non-Goals

**Goals:**
- 让首页 AI Briefing 内嵌流式问答，用户不打开弹框也能在 Tower 第一屏看到 AI 正在回答。
- 让深层 Copilot 面板继续边生成边显示答案，并在生成前先显示连接状态和来源上下文。
- overview 问答必须看见 Tower live flights，同时明确区分 live tower 情况和用户已承保敞口。
- 推荐问题、后续问题和模型建议最多展示 5 条。
- 发送给 DeepSeek 的 overview 上下文必须限量，避免把 300 条 live flights 原样塞进模型。
- DeepSeek key 保持服务端私有，流式 API 继续使用 JWT cookie 鉴权和当前用户数据边界。
- 保留非流式 `/copilot/ask`，避免破坏现有调用和测试。
- 增加可测试的流式事件协议、前端解析器、关闭取消和错误降级。

**Non-Goals:**
- 不引入持久化 Q&A 历史、会话多轮记忆或后台任务队列。
- 不允许 Copilot 创建保单、触发赔付、修改余额或替代 ClaimEngine。
- 不把 DeepSeek API key 暴露到前端构建配置。
- 不照搬 `arc-lepton` 的 research 付费工具调用、budget 或 tx 记录模型。

## Decisions

### Decision 1: 使用 `POST /copilot/ask/stream` + SSE 格式，而不是 EventSource GET

Rialo 的 Copilot 请求需要 body 携带 question、subject_type 和可选 subject_id。`EventSource` 原生只能 GET，不适合直接提交复杂请求；把 body 编码进 query 也会暴露内容并受到 URL 长度限制。因此新增 `POST /copilot/ask/stream`，响应 `text/event-stream`，前端用 `fetch()` + `ReadableStream` reader 解析 SSE。

Alternative considered: `start` 返回 id，再 `GET /copilot/{id}/stream` 订阅。这个模式适合 `arc-lepton` 的长 research job 和 replay；Rialo 当前问答短、无需持久历史，直接 POST stream 改动更小。

### Decision 2: 流式事件输出 answer text，不强制流式 JSON

DeepSeek 可以流式输出 token，但如果继续要求 `response_format=json_object`，前端会收到半截 JSON，必须等完整内容才能安全解析，体感收益很小。流式端点改为 prompt 约束自然语言/Markdown 答案，并由后端确定性输出 sources、model、status、suggested_prompts。

事件协议：
- `context`: 已构建的 scope、sources、model、live snapshot summary。
- `delta`: DeepSeek 的 answer token 增量。
- `suggestions`: 后端生成或模型安全过滤后的后续问题。
- `done`: 最终 answer、confidence、status。
- `error`: provider 错误、超时或取消后的可展示错误。

非流式 `/copilot/ask` 继续保留 JSON 模式，作为 fallback 和兼容 API。

### Decision 3: overview 上下文增加限量 live tower snapshot

`CopilotContextBuilder` 需要能读取 Tower 当前 live snapshot。实现上可注入一个只读 live context provider：从 `FlightCache` 取当前 live states，并与 DB 中的 Flight route 信息做有限合并。上下文只保留白名单字段和摘要，避免把 300 条原始数据全量塞给模型。

建议字段：
- `live_tower.total_flights`
- `live_tower.data_stale`
- `live_tower.stale_seconds`
- `live_tower.sample_flights`，限制最多 5 条，优先命名航班和有 DB route 的航班
- `insured_exposure`，保留当前用户 policies/claims/events 摘要

如果用户没有 policies，prompt 必须要求回答：“你当前没有承保敞口，但 Tower 正在跟踪 N 条 live flights。”

### Decision 4: 首页 AI Briefing 成为内嵌 Copilot，而不是只打开弹框

Tower 首页的 `AIBriefing` 不再只是 prompt chip launcher。它需要包含紧凑输入框、最多 5 个推荐问题、连接状态、流式答案区域，以及只在成功拿到最终 answer 后显示的 answer-matched `Evidence used`。用户点击推荐或提交问题时，直接在该舱位内显示 token 增量，不打开侧栏。

现有侧栏仍保留给 TopNav 和深层 subject context，例如航班详情、赔付行和证据链。这样首页能力显眼，深层上下文仍有空间展示 answer-matched `Evidence used` 和较长解释。

Alternative considered: 完全移除 Copilot 侧栏。暂不采用，因为航班/赔付详情页需要较大阅读空间，侧栏仍适合作为深层解释面板。

### Decision 5: 前端把 Copilot 状态拆成连接态、流式文本和终态结果

`CopilotProvider` 需要增加 streaming 状态：`connectionStatus`、`streamAnswer`、`streamEvents` 或等价结构。提交问题时立即打开面板，清空旧答案，收到 `context` 后只更新内部上下文缓存，收到 `delta` 后追加文本，收到 `done` 后固化为 `response`，并且只在成功最终回答后显示 answer-matched `Evidence used`。

关闭面板或发起新问题时使用 `AbortController` 取消当前 stream，避免旧请求继续写入 UI。现有 request sequence guard 可以保留，用来防止过期响应污染当前面板。

首页内嵌 AI Briefing 可以复用同一 provider，也可以使用专门的 `useCopilotStream` hook。实现优先选择最小改动：抽出 streaming API 和状态 reducer，侧栏与首页组件共用。

### Decision 6: 本地 key 配置使用服务端 `.env` 或运行时环境变量

`Settings` 已支持从服务端 `.env` 读取 `DEEPSEEK_API_KEY`。本地启动时也可以通过进程环境变量注入。两者都必须只在后端生效，前端不接收 DeepSeek key。

生产环境缺 key 时，流式端点输出 `error` 事件并结束；本地可继续使用显式 key 或后续单独增加 mock provider。

## Risks / Trade-offs

- [Risk] 流式连接中断导致半截答案。→ 前端保留已收到文本并显示“连接已中断，可重试”，后端发送 `error` 后关闭。
- [Risk] live snapshot 过大增加 token 成本。→ 后端只发送摘要和最多 5 条 sample flights，不发送完整 300 条列表。
- [Risk] 首页 AI 舱位遮挡地图。→ 用紧凑信息面板固定在当前 AI Briefing 区域，保持宽度约 28rem，答案区域限制高度并滚动。
- [Risk] 模型建议不存在的动作。→ 后续问题默认由后端按 subject type 生成，模型建议只作为补充并经过安全过滤。
- [Risk] 代理或部署平台缓冲 SSE。→ 设置 `Cache-Control: no-cache, no-transform`，本地和部署验证流式 chunk 是否实时到达。
- [Risk] 新旧 API 行为分叉。→ 复用同一个 context builder 和 safety prompt，非流式只作为 fallback，主要入口走 stream。
