# rialo-copilot Specification

## Purpose
TBD - created by archiving change add-rialo-copilot-visible-ai. Update Purpose after archive.
## Requirements
### Requirement: DeepSeek V4 Copilot 问答端点

系统 SHALL 提供受保护的 `POST /copilot/ask` 端点，基于 DeepSeek V4 为当前用户生成结构化问答结果。端点 MUST 使用 HttpOnly JWT cookie 鉴权，MUST 只读取当前用户可见上下文，MUST 不向前端暴露 DeepSeek API key。

#### Scenario: 当前用户请求总览问答
- **GIVEN** 用户已登录且服务端配置了 `DEEPSEEK_API_KEY`
- **WHEN** 客户端提交 `POST /copilot/ask`，body 包含 `subject_type="overview"` 与一个问题
- **THEN** 后端使用当前用户的航班、保单、赔付和证据摘要构建上下文
- **AND** 调用配置的 DeepSeek V4 模型
- **AND** 返回 `answer`、`sources`、`suggested_prompts`、`confidence` 和 `model`

#### Scenario: 未登录请求被拒
- **GIVEN** 请求未携带合法 JWT cookie
- **WHEN** 客户端提交 `POST /copilot/ask`
- **THEN** 后端返回 `401 Unauthorized`
- **AND** 不调用 DeepSeek API

#### Scenario: DeepSeek 密钥未配置
- **GIVEN** 服务端未配置 `DEEPSEEK_API_KEY`
- **WHEN** 已登录用户提交 `POST /copilot/ask`
- **THEN** 后端返回可识别的 unavailable 响应
- **AND** 响应说明 AI provider 未配置
- **AND** 不泄漏任何内部环境变量名称之外的密钥值

### Requirement: Copilot 上下文与引用

系统 SHALL 在调用 DeepSeek V4 前构建白名单上下文，并要求模型输出可渲染的来源引用。来源 MUST 至少包含 `type`、`id`、`label` 和可选 `href`，且 MUST 来自用户当前可访问数据。

#### Scenario: 航班详情上下文包含关联数据
- **GIVEN** 用户已登录并访问一个存在的 flight
- **WHEN** 客户端以 `subject_type="flight"` 和该 `flight_id` 提问
- **THEN** 后端上下文包含该 flight 的 callsign、route、delay metrics、live status
- **AND** 包含当前用户在该 flight 上的 policies 摘要
- **AND** 包含该 flight 的最近 claims 摘要
- **AND** 回答中的 sources 至少引用该 Flight 来源

#### Scenario: 赔付上下文引用证据链
- **GIVEN** 用户已登录并拥有一条可见 claim
- **WHEN** 客户端以 `subject_type="claim"` 和该 `claim_id` 询问赔付原因
- **THEN** 后端上下文包含 claim、policy、flight 和 evidence events 摘要
- **AND** 回答中的 sources 引用相关 Claim 与 Evidence 来源
- **AND** 回答不得声称 AI 自身触发或批准了赔付

#### Scenario: 跨用户 subject 不可访问
- **GIVEN** 用户 A 已登录
- **AND** 用户 B 拥有一份 policy 或 claim
- **WHEN** 用户 A 以用户 B 的 `policy_id` 或 `claim_id` 提交 `POST /copilot/ask`
- **THEN** 后端返回 `404 Not Found` 或 `403 Forbidden`
- **AND** 不把用户 B 的数据发送给 DeepSeek

### Requirement: Copilot 回答安全边界

系统 SHALL 将 Copilot 输出限制为解释、总结、导航和建议用户查看现有信息。Copilot MUST NOT 创建保单、修改保单、触发赔付、修改余额或覆盖 ClaimEngine 的确定性结算结果。

#### Scenario: 用户要求 AI 直接买险
- **GIVEN** 用户已登录并打开 Copilot
- **WHEN** 用户询问“帮我直接买 20 RIA 这班航班”
- **THEN** Copilot 回答解释无法直接执行买险
- **AND** 提供前往现有购买入口的建议
- **AND** 后端不创建 policy，不修改 balance

#### Scenario: 用户要求 AI 改变赔付结果
- **GIVEN** 用户已登录并针对一条 claim 提问
- **WHEN** 用户要求 Copilot 把未赔付改成已赔付
- **THEN** Copilot 回答说明赔付由规则和证据决定
- **AND** 不调用任何会改变 claim 或 policy 状态的业务方法

### Requirement: Copilot 错误与降级

系统 SHALL 对 DeepSeek V4 调用超时、网络错误、非 JSON 响应和 provider 错误提供稳定错误映射，使前端可以展示可恢复状态，且原页面功能不受影响。

#### Scenario: DeepSeek 调用超时
- **GIVEN** DeepSeek API 在配置超时时间内无响应
- **WHEN** 用户提交 Copilot 问题
- **THEN** 后端返回 `503 Service Unavailable` 或结构化 `status="unavailable"`
- **AND** 前端展示 AI 暂时不可用状态
- **AND** 当前航班、保单、赔付页面仍保持可操作

#### Scenario: DeepSeek 返回非 JSON 内容
- **GIVEN** DeepSeek API 返回无法解析为约定 JSON 的内容
- **WHEN** 后端解析响应
- **THEN** 后端返回可识别的 provider error
- **AND** 不把原始 provider 响应全文暴露给前端

### Requirement: DeepSeek V4 Copilot 流式问答端点

系统 SHALL 提供受保护的 `POST /copilot/ask/stream` 端点，使用 DeepSeek V4 streaming chat completions 为当前用户输出增量回答。端点 MUST 使用 HttpOnly JWT cookie 鉴权，MUST 只读取当前用户可见上下文，MUST 不向前端暴露 DeepSeek API key。

#### Scenario: 当前用户收到流式回答
- **GIVEN** 用户已登录且服务端配置了 `DEEPSEEK_API_KEY`
- **WHEN** 客户端提交 `POST /copilot/ask/stream`，body 包含 `subject_type="overview"` 与一个问题
- **THEN** 后端返回 `text/event-stream`
- **AND** 先发送包含 scope、sources 和 model 的 `context` 事件
- **AND** 随后发送一个或多个 `delta` 事件
- **AND** 最后发送 `done` 事件并关闭响应流

#### Scenario: 未登录流式请求被拒
- **GIVEN** 请求未携带合法 JWT cookie
- **WHEN** 客户端提交 `POST /copilot/ask/stream`
- **THEN** 后端返回 `401 Unauthorized`
- **AND** 不调用 DeepSeek API

#### Scenario: DeepSeek 密钥未配置
- **GIVEN** 服务端未配置 `DEEPSEEK_API_KEY`
- **WHEN** 已登录用户提交 `POST /copilot/ask/stream`
- **THEN** 后端发送 `error` 事件或返回可识别的 unavailable 响应
- **AND** 用户可见的 unavailable 响应与恢复提示使用英文
- **AND** 不泄漏任何密钥值

### Requirement: Copilot 流式事件协议

系统 SHALL 使用稳定的 SSE 事件协议输出 Copilot 状态。事件名称 MUST 为 `context`、`delta`、`suggestions`、`done` 或 `error`，每个事件的 `data` MUST 是 JSON 字符串。`suggestions` 和 `done.suggested_prompts` MUST 最多包含 5 条推荐问题。

#### Scenario: context 事件包含来源
- **GIVEN** 后端已构建 Copilot 上下文
- **WHEN** 流式响应开始
- **THEN** `context` 事件包含 `subject_type`、可选 `subject_id`、`sources`、`model` 和可展示的上下文摘要
- **AND** `sources` 每项至少包含 `type`、`id`、`label` 和可选 `href`
- **AND** `label` 使用英文前缀，如 `Flight ...`、`Policy ...`、`Claim ...` 或 `Evidence ...`

#### Scenario: delta 事件追加答案
- **GIVEN** DeepSeek 返回流式内容
- **WHEN** 后端收到非空 token delta
- **THEN** 后端发送 `delta` 事件
- **AND** `data.delta` 为可直接追加到当前答案缓冲区的文本
- **AND** 任何包含非英文页面可见文本（例如 CJK）的 delta MUST 在发送前被后端拒绝，并改为安全英文错误

#### Scenario: done 事件完成回答
- **GIVEN** DeepSeek 流式输出结束
- **WHEN** 后端完成最终 answer 聚合
- **THEN** 后端发送 `done` 事件
- **AND** `data.answer` 等于所有 `delta` 文本的拼接结果
- **AND** `data.status` 为 `ok`
- **AND** `data.suggested_prompts` 最多包含 5 条
- **AND** `data.answer` 与 `data.suggested_prompts` 中所有用户可见文本都必须为英文；不满足时 MUST 改为安全英文错误或英文 fallback

#### Scenario: error 事件安全降级
- **GIVEN** DeepSeek 调用超时、网络错误或返回异常
- **WHEN** 后端无法继续生成答案
- **THEN** 后端发送 `error` 事件
- **AND** 事件包含可展示的错误码和英文错误信息
- **AND** 不包含原始 provider 响应全文或密钥值

### Requirement: Copilot 上下文与安全边界

系统 SHALL 在调用 DeepSeek V4 前构建白名单上下文，并将 Copilot 输出限制为解释、总结、导航和建议用户查看现有信息。Copilot MUST NOT 创建保单、修改保单、触发赔付、修改余额或覆盖 ClaimEngine 的确定性结算结果。

#### Scenario: 航班详情上下文包含关联数据
- **GIVEN** 用户已登录并访问一个存在的 flight
- **WHEN** 客户端以 `subject_type="flight"` 和该 `flight_id` 提交流式问题
- **THEN** 后端上下文包含该 flight 的 callsign、route、delay metrics 和 live status
- **AND** 包含当前用户在该 flight 上的 policies 摘要
- **AND** 包含该 flight 的最近 claims 摘要
- **AND** 回答 sources 至少引用该 Flight 来源

#### Scenario: 赔付上下文引用证据链
- **GIVEN** 用户已登录并拥有一条可见 claim
- **WHEN** 客户端以 `subject_type="claim"` 和该 `claim_id` 询问赔付原因
- **THEN** 后端上下文包含 claim、policy、flight 和 evidence events 摘要
- **AND** 回答 sources 引用相关 Claim 与 Evidence 来源
- **AND** 回答不得声称 AI 自身触发或批准了赔付

#### Scenario: 跨用户 subject 不可访问
- **GIVEN** 用户 A 已登录
- **AND** 用户 B 拥有一份 policy 或 claim
- **WHEN** 用户 A 以用户 B 的 `policy_id` 或 `claim_id` 提交流式问题
- **THEN** 后端返回 `404 Not Found` 或 `403 Forbidden`
- **AND** 不把用户 B 的数据发送给 DeepSeek

#### Scenario: 用户要求 AI 直接买险
- **GIVEN** 用户已登录并打开 Copilot
- **WHEN** 用户询问“帮我直接买 20 RIA 这班航班”
- **THEN** Copilot 回答解释无法直接执行买险
- **AND** 提供前往现有购买入口的建议
- **AND** 后端不创建 policy，不修改 balance

### Requirement: 首页内嵌 Copilot 流式体验

系统 SHALL 在 Tower 首页 AI Briefing 中直接提供 Copilot 输入、最多 5 个推荐问题、连接状态、实时光标、流式答案、基于答案匹配的 `Evidence used` 摘要和错误降级状态。用户在首页提问或点击首页推荐问题时 MUST NOT 需要打开弹框。

#### Scenario: 首页 AI Briefing 可折叠与重新展开
- **GIVEN** 用户已登录并停留在 Tower 首页
- **AND** AI Briefing 已显示输入框、推荐问题或 inline answer
- **WHEN** 用户点击 `Collapse AI Briefing`
- **THEN** AI Briefing 收起为仅显示英文紧凑 pill 级入口（例如 `AI Briefing` 与 `Open`）的状态
- **AND** 隐藏 `AI Briefing question`、推荐问题、答案区和 `Evidence used` 主体内容
- **AND** 前端不调用 `ask`、`stop` 或 `openPanel`
- **AND** 已在进行的流式请求继续进行且不得因此取消
- **WHEN** 用户随后点击 `Expand AI Briefing`
- **THEN** 原有输入内容、推荐问题以及当前流式或最终回答状态恢复显示

#### Scenario: TopNav 不重复提供 overview AI 入口
- **GIVEN** 用户已登录并看到受保护页面的 TopNav
- **WHEN** 页面同时存在 Tower 首页 `AI Briefing` 总览入口
- **THEN** TopNav 不显示全局 `Ask Rialo` overview 按钮
- **AND** TopNav 不会因为渲染而触发 `openPanel`
- **AND** 深层航班、保单、赔付或证据上下文仍可通过既有按钮或 PromptChip 打开 Copilot 面板

#### Scenario: 首页提交后直接显示生成态
- **GIVEN** 用户已登录并停留在 Tower 首页
- **WHEN** 用户在 AI Briefing 中提交一个非空 overview 问题
- **THEN** AI Briefing 立即显示连接中或生成中状态
- **AND** 不打开 Copilot 弹框或侧栏
- **AND** 不等待完整答案返回才显示 UI 反馈

#### Scenario: 首页 delta 到达时实时追加
- **GIVEN** 首页 AI Briefing 正在等待流式回答
- **WHEN** 前端收到 `delta` 事件
- **THEN** AI Briefing 将 `delta` 文本追加到当前答案区域
- **AND** 答案区域显示实时光标或等价生成中提示

#### Scenario: 首页推荐问题最多 5 条
- **GIVEN** Tower 首页 AI Briefing 已渲染
- **WHEN** 页面展示默认推荐或模型返回后续问题
- **THEN** 推荐问题最多显示 5 条
- **AND** 多余推荐被丢弃

#### Scenario: 首页新问题取消旧流
- **GIVEN** 首页 AI Briefing 的流式回答尚未完成
- **WHEN** 用户提交新的首页问题
- **THEN** 前端取消当前请求
- **AND** 旧请求后续事件不得覆盖新问题状态

#### Scenario: 首页流式错误展示可恢复状态
- **GIVEN** 前端收到 `error` 事件或 stream 连接异常
- **WHEN** 首页 AI Briefing 渲染错误状态
- **THEN** AI Briefing 保留已收到的部分答案
- **AND** 显示可重试提示
- **AND** Tower 地图和购买交互保持可用

#### Scenario: 首页只展示答案引用到的 evidence
- **GIVEN** 首页 AI Briefing 已收到最终 answer 与 `context.sources`
- **WHEN** answer 文本能够匹配某些 evidence token（如 source id、英文 label、flight callsign、claim/policy id）
- **THEN** 首页在 answer 下方显示英文标题 `Evidence used`
- **AND** 只显示命中的 evidence，最多 3 条
- **AND** 如果 answer 未匹配任何 evidence，则不显示 evidence 区域，也不显示空状态
- **AND** 只有在最终成功 answer（`status="ok"`、无错误且不再 streaming）时才允许显示 evidence

### Requirement: 深层 Copilot 面板流式体验

系统 SHALL 在 Copilot 面板中边接收边显示回答，并展示连接状态、实时光标、基于答案匹配的 `Evidence used`、suggested prompts 和错误降级状态。

#### Scenario: 提交后立即显示生成态
- **GIVEN** 用户已登录并打开 Copilot 面板
- **WHEN** 用户提交一个非空问题
- **THEN** 面板立即显示连接中或生成中状态
- **AND** submit 按钮进入 busy 状态
- **AND** 不等待完整答案返回才显示 UI 反馈

#### Scenario: delta 到达时实时追加
- **GIVEN** Copilot 面板正在等待流式回答
- **WHEN** 前端收到 `delta` 事件
- **THEN** 面板将 `delta` 文本追加到当前答案区域
- **AND** 答案区域显示实时光标或等价生成中提示

#### Scenario: 面板以轻量 transcript 呈现流式回答
- **GIVEN** 用户已在深层页面打开 Copilot 面板
- **WHEN** Copilot 正在连接或 streaming
- **THEN** 面板以 inline transcript 或 article 形式直接连续追加答案正文
- **AND** 标题区或答案头部仅显示细粒度 live 状态（例如 `connecting` 或 `streaming`）与轻量光标
- **AND** 面板不得显示阻塞阅读的大块状态卡片或 `Streaming the current Rialo answer...` 固定提示文案

#### Scenario: 用户关闭面板取消当前流
- **GIVEN** Copilot 流式回答尚未完成
- **WHEN** 用户关闭 Copilot 面板或提交新的问题
- **THEN** 前端取消当前请求
- **AND** 旧请求后续事件不得覆盖新问题状态

#### Scenario: 流式错误展示可恢复状态
- **GIVEN** 前端收到 `error` 事件或 stream 连接异常
- **WHEN** Copilot 面板渲染错误状态
- **THEN** 面板保留已收到的部分答案
- **AND** 显示可重试提示
- **AND** 原页面其他航班、保单和赔付交互保持可用

#### Scenario: 深层推荐问题最多 5 条
- **GIVEN** Copilot 面板正在展示默认推荐或模型返回后续问题
- **WHEN** 面板渲染推荐问题
- **THEN** 推荐问题最多显示 5 条
- **AND** 多余推荐被丢弃

#### Scenario: 面板不再固定展示全部 sources
- **GIVEN** Copilot 面板已收到 `context.sources`
- **WHEN** answer 尚未引用任一 evidence，或仍处于中间流式生成阶段
- **THEN** 面板不显示固定的 `Sources` 列表
- **AND** 只有在最终 answer 匹配到 evidence 时才显示 `Evidence used`
- **AND** 命中的 evidence 最多显示 3 条并保留现有点击导航能力
- **AND** 如果流式过程以 `error` 收尾，即使保留部分 answer，也 MUST NOT 显示 `Evidence used`
