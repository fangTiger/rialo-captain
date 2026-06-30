## ADDED Requirements

### Requirement: 保单风险投影只读数据
系统 SHALL 为当前用户的保单列表提供只读风险投影字段，用于 My Hangar 和 Flight Detail 展示当前承保风险；这些字段 MUST NOT 改变投保、ClaimEngine 结算或证据链写入语义。

#### Scenario: 保单列表包含风险投影字段
- **GIVEN** 当前用户已登录并拥有至少一张 policy
- **WHEN** 用户请求 `GET /policies`
- **THEN** 每条 policy 响应 SHALL 保留现有字段 `id`、`flight_id`、`premium`、`payout`、`status`、`contract_ref` 和 `created_at`
- **AND** 每条 policy 响应 SHALL 包含 `delay_threshold_minutes`
- **AND** 每条 policy 响应 SHALL 包含 `live_delay_minutes`
- **AND** 每条 policy 响应 SHALL 包含 `minutes_until_trigger`
- **AND** 每条 policy 响应 SHALL 包含 `risk_level`
- **AND** 每条 policy 响应 SHALL 包含 `risk_reason`

#### Scenario: Active policy 达到触发阈值
- **GIVEN** 一张 active policy 的延误阈值为 30 分钟
- **AND** 当前航班 live delay 为 45 分钟
- **WHEN** 用户请求 `GET /policies`
- **THEN** 该 policy 的 `risk_level` SHALL 为 `triggered`
- **AND** `minutes_until_trigger` SHALL 为 0
- **AND** `live_delay_minutes` SHALL 为 45
- **AND** ClaimEngine 是否已经完成赔付 SHALL 仍由既有结算流程决定

#### Scenario: Active policy 接近触发阈值
- **GIVEN** 一张 active policy 的延误阈值为 30 分钟
- **AND** 当前航班 live delay 为 20 到 29 分钟之间
- **WHEN** 用户请求 `GET /policies`
- **THEN** 该 policy 的 `risk_level` SHALL 为 `watch`
- **AND** `minutes_until_trigger` SHALL 等于 `30 - live_delay_minutes`

#### Scenario: Active policy 未接近触发阈值
- **GIVEN** 一张 active policy 的延误阈值为 30 分钟
- **AND** 当前航班 live delay 小于 20 分钟
- **WHEN** 用户请求 `GET /policies`
- **THEN** 该 policy 的 `risk_level` SHALL 为 `normal`
- **AND** `minutes_until_trigger` SHALL 等于 `30 - live_delay_minutes`

#### Scenario: Active policy 缺少 live delay
- **GIVEN** 一张 active policy 的当前航班无法计算 live delay
- **WHEN** 用户请求 `GET /policies`
- **THEN** 该 policy 的 `risk_level` SHALL 为 `unknown`
- **AND** `live_delay_minutes` SHALL 为 null
- **AND** `minutes_until_trigger` SHALL 为 null
- **AND** 响应 SHALL NOT 返回 500

#### Scenario: 非 active policy 风险投影不参与触发倒计时
- **GIVEN** 当前用户拥有 paid 或 expired policy
- **WHEN** 用户请求 `GET /policies`
- **THEN** paid policy 的 `risk_level` SHALL 为 `settled`
- **AND** expired policy 的 `risk_level` SHALL 为 `inactive`
- **AND** 两者的 `minutes_until_trigger` SHALL 为 null

#### Scenario: 风险投影不影响自动赔付语义
- **GIVEN** `GET /policies` 为某 active policy 返回 `risk_level="triggered"`
- **WHEN** 后台 ClaimEngine 检查该 policy
- **THEN** ClaimEngine SHALL 继续使用既有观测源、condition 和 adapter 结算流程
- **AND** ClaimEngine SHALL NOT 读取 `risk_level` 或 `minutes_until_trigger` 作为结算依据
- **AND** 既有 claim 创建、policy 状态更新、余额更新和 evidence 写入语义 SHALL 保持不变
