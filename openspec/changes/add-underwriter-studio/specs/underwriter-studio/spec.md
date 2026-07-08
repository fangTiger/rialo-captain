## ADDED Requirements

### Requirement: 用户可创建单个活跃承保池
系统 SHALL 允许已登录用户在 `/studio` 通过 preset、规则参数与 stake 创建一个 active underwriter pool。系统 MUST 在数据库层使用 partial unique index 保证同一用户同一时间最多一个 `status='active'` 的 pool，并在创建池时扣除用户 stake、初始化 pool balance 与写入 `pool.opened` 事件。

#### Scenario: 创建第一个活跃池
- **GIVEN** 用户已登录且没有 active pool
- **WHEN** 用户提交 `POST /pools`，包含 preset、delay threshold、payout multiplier、stake 和三个 rule toggles
- **THEN** 系统 SHALL 创建 `status='active'` 的 pool
- **AND** 系统 SHALL 从用户余额扣除 `stake_ria`
- **AND** pool balance SHALL 等于初始 stake
- **AND** 系统 SHALL 广播 `pool.opened`

#### Scenario: 拒绝第二个活跃池
- **GIVEN** 用户已有一个 `status='active'` 的 pool
- **WHEN** 用户再次提交 `POST /pools`
- **THEN** 系统 SHALL 返回 `409 Conflict`
- **AND** 数据库 SHALL 保证不会持久化第二个 active pool
- **AND** 用户余额 SHALL NOT 被重复扣除

#### Scenario: 关闭池返还可用余额
- **GIVEN** 用户拥有一个 active pool
- **AND** 该 pool 存在未命中且仍 active 的 bound policies
- **WHEN** 用户请求 `DELETE /pools/{id}`
- **THEN** 系统 SHALL 关闭 pool 并写入 `pool.closed`，reason 为 `user`
- **AND** 系统 SHALL 解绑未命中 active policies 的 `underwriter_pool_id`
- **AND** 系统 SHALL 将可返还 pool balance 归还用户余额

### Requirement: 承保规则只影响未来匹配
系统 SHALL 允许用户更新 active pool 的 delay threshold、payout multiplier 和三个 rule toggles，但 SHALL NOT 允许 PATCH 修改 stake。规则变更 MUST 只影响未来 Passenger Simulator 匹配，不追溯已绑定 active policy。

#### Scenario: 更新规则不追溯已绑 policy
- **GIVEN** 用户拥有 active pool
- **AND** policy `P1` 已经绑定到该 pool
- **WHEN** 用户 PATCH pool 规则，使 `P1` 不再满足新规则
- **THEN** `P1.underwriter_pool_id` SHALL 保持不变
- **AND** pool 已有 exposure、balance 和 timeline SHALL 保持一致
- **AND** 后续 Simulator 匹配 SHALL 使用新规则

#### Scenario: 拒绝修改 stake
- **GIVEN** 用户拥有 active pool
- **WHEN** 用户 PATCH 请求包含 `stake_ria`
- **THEN** 系统 SHALL 拒绝该字段或忽略该字段
- **AND** pool stake 与 balance SHALL NOT 因该 PATCH 被重置

#### Scenario: 规则更新广播
- **GIVEN** 用户拥有 active pool 且有多个浏览器标签连接 WebSocket
- **WHEN** 用户成功 PATCH pool 规则
- **THEN** 系统 SHALL 广播 `pool.rule_updated`
- **AND** 当前用户所有连接 SHALL 收到新的 rule payload

### Requirement: Passenger Simulator 自动生成并匹配乘客保单
系统 SHALL 在 `POOL_SIMULATOR_ENABLED=true` 时启动 Passenger Simulator，并每 8 至 15 秒随机生成一次模拟乘客投保意向。Simulator MUST 使用隐藏的 SYSTEM_SIM_USER 创建 policy，优先选择高延误概率 live flight，并通过 matcher 将符合规则的 policy 绑定到第一个匹配的 active pool。

#### Scenario: Simulator 首单在演示窗口内绑定
- **GIVEN** 至少存在一个 active pool
- **AND** 存在可投保 live flight
- **WHEN** Passenger Simulator 运行
- **THEN** 系统 SHALL 在 15 秒演示窗口内产生可绑定 policy 的机会
- **AND** 匹配成功时 policy SHALL 写入 `underwriter_pool_id`
- **AND** pool balance SHALL 增加该 policy premium
- **AND** 系统 SHALL 广播 `pool.policy_bound`

#### Scenario: SYSTEM_SIM_USER 隐藏不可登录
- **GIVEN** Simulator 需要创建模拟乘客 policy
- **WHEN** 系统 seed SYSTEM_SIM_USER
- **THEN** SYSTEM_SIM_USER SHALL 幂等存在
- **AND** SYSTEM_SIM_USER SHALL NOT 能通过用户登录入口登录
- **AND** SYSTEM_SIM_USER SHALL NOT 出现在 leaderboard 或普通用户列表中

#### Scenario: 未匹配 policy 保持现有系统承保语义
- **GIVEN** Simulator 创建了一张 policy
- **AND** 没有 active pool 匹配该 policy
- **WHEN** policy 被持久化
- **THEN** `underwriter_pool_id` SHALL 为 null
- **AND** 后续 ClaimEngine SHALL 走现有无池赔付路径

### Requirement: 承保池赔付集成自动理赔流程
系统 SHALL 在 ClaimEngine 自动结算时识别已绑定 pool 的 policy。若 `underwriter_pool_id` 存在，赔付 MUST 从 pool balance 扣除；若不存在，现有虚拟系统承保行为 SHALL 保持不变。Pool balance 小于或等于 0 后，系统 SHALL 在当前 tick 完成后关闭 pool，reason 为 `bankrupt`，且允许 balance 为负。

#### Scenario: 绑定 policy 从 pool 扣款
- **GIVEN** active policy `P1` 绑定到 pool `A`
- **AND** `P1` 的延误条件被 ClaimEngine 命中
- **WHEN** ClaimEngine 创建 claim 并完成结算
- **THEN** pool `A` balance SHALL 减少 claim payout
- **AND** 系统 SHALL 广播 `pool.claim_paid`
- **AND** `claim.settled` payload SHALL 包含 `pool_id`

#### Scenario: 无池 policy 保持回归兼容
- **GIVEN** active policy `P2` 没有 `underwriter_pool_id`
- **WHEN** `P2` 的延误条件被 ClaimEngine 命中
- **THEN** 系统 SHALL 使用现有赔付流程更新 policy、claim、用户余额和 WebSocket 事件
- **AND** 系统 SHALL NOT 广播 `pool.claim_paid`

#### Scenario: 破产关闭保留已绑活跃 policy
- **GIVEN** active pool balance 为正
- **AND** 同一 ClaimEngine tick 内多个 bound policies 命中
- **WHEN** 全部命中 policy 完成结算后 pool balance 小于或等于 0
- **THEN** pool SHALL 关闭为 `closed_bankrupt`
- **AND** pool balance MAY 为负
- **AND** 已经绑定且仍 active 的 policies SHALL 保留 `underwriter_pool_id` 并继续跑完

### Requirement: Studio REST API 与 timeline
系统 SHALL 提供 `/pools` REST API，用于创建、读取当前用户 active pool、更新规则、关闭池和读取 pool timeline。普通用户 MUST 只能访问自己的 pool；不存在或不属于当前用户的 pool MUST 不泄露资源存在性。

#### Scenario: 读取当前用户 active pool
- **GIVEN** 用户已登录
- **WHEN** 用户请求 `GET /pools/me`
- **THEN** 系统 SHALL 返回该用户 active pool
- **AND** 若不存在 active pool，系统 SHALL 返回 null

#### Scenario: 跨用户 pool 被隐藏
- **GIVEN** 用户 A 拥有 pool `A`
- **AND** 用户 B 已登录
- **WHEN** 用户 B 请求 `PATCH /pools/A`、`DELETE /pools/A` 或 `GET /pools/A/timeline`
- **THEN** 系统 SHALL 返回 404 或等价隐藏响应
- **AND** 响应 SHALL NOT 暴露 pool `A` 是否存在

#### Scenario: timeline 返回有序 pool 事件
- **GIVEN** 当前用户拥有 pool `A`
- **AND** pool `A` 已产生 opened、bound、paid 或 closed 事件
- **WHEN** 用户请求 `GET /pools/A/timeline?limit=50`
- **THEN** 系统 SHALL 返回按时间倒序或产品指定顺序稳定排序的 pool events
- **AND** 每个 event SHALL 包含 type、created_at 和结构化 payload

### Requirement: Tower 显示当前用户承保状态
系统 SHALL 在 live flight payload 中提供当前用户相关的 `underwritten_by_pool_id`，并在 Tower 中用绿色 dot 表示当前用户池子承保的航班。该绿色 dot MUST 与现有 protagonist 粉红外圈 ring 正交共存；claim paid 时 SHALL 显示 1.4 秒绿色 FLARE 事件层。

#### Scenario: 承保航班显示绿色 dot
- **GIVEN** 当前用户拥有 active pool
- **AND** live flight `F1` 对应的 policy 已绑定该 pool
- **WHEN** Tower 渲染 `F1`
- **THEN** `F1` dot SHALL 使用 `.flight-dot--mine`
- **AND** dot 内点 SHALL 使用 `--accent-radar`

#### Scenario: Protagonist ring 与 underwriter dot 共存
- **GIVEN** flight `F1` 同时是 protagonist flight 和当前用户承保 flight
- **WHEN** Tower 渲染 `F1`
- **THEN** `F1` SHALL 保留现有粉红 protagonist 外圈 ring
- **AND** `F1` 内点 SHALL 显示承保绿色
- **AND** 两个视觉状态 SHALL NOT 覆盖或移除彼此

#### Scenario: Pool payout 触发绿色 FLARE
- **GIVEN** 当前用户池子为 flight `F1` 支付 claim
- **WHEN** 前端收到 `pool.claim_paid`
- **THEN** Tower SHALL 在 `F1` 位置显示绿色 FLARE pulse
- **AND** FLARE SHALL 在约 1.4 秒后自动消失

### Requirement: Studio 前端体验
系统 SHALL 提供 `/studio` protected route，包含 Empty 与 Active 两态。前端用户可见文案 MUST 为英文；视觉 MUST 使用 `frontend/src/design/tokens.css` 中已有 tokens，不得新增独立配色或字体 family。

#### Scenario: Empty 状态开池
- **GIVEN** 用户已登录且没有 active pool
- **WHEN** 用户打开 `/studio`
- **THEN** 页面 SHALL 显示标题 `Underwrite delay risk in 3 seconds.`
- **AND** 页面 SHALL 显示三张 preset card、rule chip 行、stake slider、Expected 7d hit/PL 和 `OPEN POOL ▸`
- **AND** 用户点击 CTA 成功后 SHALL 调用 `POST /pools`

#### Scenario: Active 状态展示战况
- **GIVEN** 用户已登录且拥有 active pool
- **WHEN** 用户打开 `/studio`
- **THEN** 页面 SHALL 显示 KPI band：EXPOSURE、HITS 24H、PAID OUT、P/L
- **AND** 页面 SHALL 显示可编辑 rule line、event ticker 和 `CLOSE POOL`
- **AND** pool.* WS 事件 SHALL 实时更新 KPI 与 ticker

#### Scenario: Dev inject 按钮仅开发登录可见
- **GIVEN** `DEV_LOGIN_ENABLED=true` 且前端开发配置允许 dev login
- **WHEN** 用户打开 `/studio`
- **THEN** 页面 MAY 显示 `Inject demo delay`
- **AND** 点击该按钮 SHALL 调用现有 inject-delay 路径触发演示赔付
- **AND** 当 dev login 未启用时该按钮 SHALL NOT 可见

### Requirement: TopNav STUDIO 入口和 P/L badge
系统 SHALL 在顶部导航新增 `STUDIO` tab。无 active pool 时只显示 `STUDIO`；有 active pool 时根据 P/L 显示 badge，正数使用 `--accent-radar`，负数使用 `--warn-amber`；破产关闭瞬间可短暂显示 `CLOSED`。

#### Scenario: 无池显示普通 STUDIO
- **GIVEN** 用户没有 active pool
- **WHEN** TopNav 渲染
- **THEN** 导航 SHALL 显示 `STUDIO`
- **AND** 不显示 P/L badge

#### Scenario: 正负 P/L 使用不同 token
- **GIVEN** 用户拥有 active pool
- **WHEN** pool P/L 大于或等于 0
- **THEN** TopNav SHALL 显示 `STUDIO · +N` 且使用 `--accent-radar`
- **WHEN** pool P/L 小于 0
- **THEN** TopNav SHALL 显示 `STUDIO · −N` 且使用 `--warn-amber`

#### Scenario: 破产关闭短暂提示
- **GIVEN** 用户 active pool 因 bankrupt 被关闭
- **WHEN** 前端收到 `pool.closed(reason=bankrupt)`
- **THEN** TopNav MAY 短暂显示 `STUDIO · CLOSED`
- **AND** 约 1 秒后 SHALL 回到普通 `STUDIO`

### Requirement: Copilot 复用现有 stream 注入 Studio 上下文
系统 SHALL 复用 `/copilot/ask/stream` 为 Studio 提供主动 briefing 和被动问答，不得新增 Copilot endpoint。Copilot 上下文 SHALL 包含当前 pool、规则、bound policies、claims、balance、P/L 和最近 pool events。

#### Scenario: 无池首页提示承保入口
- **GIVEN** 用户没有 active pool
- **AND** 用户访问 Tower 首页或 Studio 空态
- **WHEN** Copilot overview briefing 被请求
- **THEN** Copilot SHALL 能基于上下文提示用户尝试 underwriting
- **AND** 提示文案 SHALL 为英文

#### Scenario: Pool opened 后主动 briefing
- **GIVEN** 用户成功打开 pool
- **WHEN** 前端在约 3 秒后请求 Copilot stream
- **THEN** 请求 SHALL 使用现有 `/copilot/ask/stream`
- **AND** context event SHALL 包含 pool summary

#### Scenario: Bind 与 payout 触发战况更新
- **GIVEN** 用户 active pool 已经收到 bound 或 payout 事件
- **WHEN** 首次 bind、每累计 5 次 bind、每次 payout 或 bankrupt 发生
- **THEN** 前端 SHALL 通过现有 Copilot stream 请求 briefing
- **AND** Copilot SHALL 基于 pool 上下文解释风险、赔付和下一步

### Requirement: Dev login 与真实 AI provider 约束保持不变
系统 SHALL 保持演示阶段 dev login 能力可见可用，并且本地 Rialo Copilot 默认使用真实 AI provider。Underwriter Studio 不得引入会关闭 dev login、隐藏 `/auth/dev-login`、关闭真实 provider 或将本地 Copilot 降级为 fake/mock/offline 的变更。

#### Scenario: Dev login 未被弱化
- **GIVEN** 本地开发或演示配置
- **WHEN** Underwriter Studio 代码加载
- **THEN** `DEV_LOGIN_ENABLED`、`VITE_DEV_LOGIN_ENABLED` 和 `/auth/dev-login` 语义 SHALL 保持可用
- **AND** 用户 SHALL 仍可通过 dev login 进入 `/studio`

#### Scenario: Copilot 不降级为假 provider
- **GIVEN** 后端 `.env` 存在有效 `DEEPSEEK_API_KEY`
- **WHEN** 用户在 Studio 请求 Copilot briefing
- **THEN** 系统 SHALL 通过真实 provider 调用 `/copilot/ask/stream`
- **AND** 响应 SHALL NOT 因 Studio 变更被固定为 unavailable/mock/offline
