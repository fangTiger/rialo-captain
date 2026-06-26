## ADDED Requirements

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
