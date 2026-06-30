## ADDED Requirements

### Requirement: My Hangar 风险驾驶舱
系统 SHALL 在 `/policies` My Hangar 页面展示当前用户保单风险驾驶舱摘要，并保持现有保单分组、整卡跳转航班详情、Evidence 操作和 Copilot 操作可用。

#### Scenario: My Hangar 展示风险摘要
- **GIVEN** 当前用户拥有 active、paid 和 expired 保单
- **WHEN** `/policies` 页面加载完成
- **THEN** 页面 SHALL 展示 active exposure，为 active policies 的 `premium` 合计
- **AND** 页面 SHALL 展示 max potential payout，为 active policies 的 `payout` 合计
- **AND** 页面 SHALL 展示 settled payout，为 paid policies 的 `payout` 合计
- **AND** 页面 SHALL 展示 at-risk policies，为 active 且 `risk_level` 为 `triggered` 或 `watch` 的保单数量

#### Scenario: 空持仓摘要显示零值
- **GIVEN** 当前用户没有任何保单
- **WHEN** `/policies` 页面加载完成
- **THEN** 风险摘要 SHALL 显示 0 RIA active exposure
- **AND** 风险摘要 SHALL 显示 0 RIA max potential payout
- **AND** 风险摘要 SHALL 显示 0 at-risk policies
- **AND** 现有分组空态 SHALL 保持可见

#### Scenario: Active 保单按风险优先排序
- **GIVEN** 当前用户拥有多个 active policies，且它们的 `risk_level` 分别为 `normal`、`unknown`、`watch` 和 `triggered`
- **WHEN** My Hangar 渲染 ACTIVE lane
- **THEN** ACTIVE lane SHALL 按 `triggered`、`watch`、`unknown`、`normal` 的风险优先级排序
- **AND** 同一风险等级内 SHALL 按 `payout DESC` 排序
- **AND** payout 相同时 SHALL 按 `created_at DESC` 排序

#### Scenario: 保单卡片展示风险投影
- **GIVEN** 当前用户在 My Hangar 看到一张 active policy
- **WHEN** 该 policy 响应包含 `risk_level`、`live_delay_minutes`、`minutes_until_trigger` 和 `risk_reason`
- **THEN** 保单卡片 SHALL 展示 risk level
- **AND** 保单卡片 SHALL 展示 live delay，缺失时显示数据不可用占位
- **AND** 保单卡片 SHALL 展示距离 30 分钟触发阈值的分钟数，已达到阈值时显示已到达阈值
- **AND** 保单卡片 SHALL 继续展示 premium、payout、contract ref、Evidence 操作和 Copilot prompt

#### Scenario: Evidence 操作不破坏保单卡片跳转
- **GIVEN** 用户在 My Hangar 看到一张保单卡片
- **WHEN** 用户点击该卡片的 Evidence 操作
- **THEN** 页面 SHALL 打开 Evidence Drawer
- **AND** URL SHALL 保持 `/policies`
- **AND** 系统 SHALL NOT 跳转到 `/flight/{policy.flight_id}`
- **WHEN** 用户点击该卡片非 Evidence 操作区域
- **THEN** 页面 SHALL 跳转 `/flight/{policy.flight_id}`，并携带 `location.state.from === "/policies"`

### Requirement: Flight Detail 报价解释
系统 SHALL 在 `/flight/:id` 的购买区域解释当前报价与覆盖条件，使用户能在购买前理解保费、倍率、历史延误率、潜在赔付和自动结算规则。

#### Scenario: 未持有 active policy 时展示报价解释
- **GIVEN** 当前用户没有该航班的 active policy
- **AND** Flight Detail 已取得 `delay_rate` 与可计算 multiplier
- **WHEN** Insure 区域渲染
- **THEN** 页面 SHALL 展示当前 premium tier
- **AND** 页面 SHALL 展示 estimated payout
- **AND** 页面 SHALL 展示 multiplier
- **AND** 页面 SHALL 展示历史 delay rate
- **AND** 页面 SHALL 展示 coverage condition 为 delayed `>= 30 min`
- **AND** 页面 SHALL 说明结算由 Rialo reactive contract 自动执行

#### Scenario: 报价解释随 premium 变化更新
- **GIVEN** 用户在 Flight Detail 的 Insure 区域选择不同 premium tier
- **WHEN** premium 从 5 RIA 切换为 20 RIA
- **THEN** estimated payout SHALL 按当前 multiplier 重新计算
- **AND** coverage condition、delay rate 和 multiplier 说明 SHALL 保持一致

#### Scenario: 航班数据缺失时报价解释降级
- **GIVEN** Flight Detail 处于 flight 404 或 `delay_rate` 不可用状态
- **WHEN** Insure 区域渲染报价解释
- **THEN** 页面 SHALL 使用占位文案显示 delay rate 或 multiplier 不可用
- **AND** 页面 SHALL NOT 抛出运行时错误
- **AND** 用户 SHALL 不能基于未知航班成功创建新 policy

### Requirement: Flight Detail active 持仓摘要
系统 SHALL 在用户已持有当前航班 active policy 时，用 active holding summary 替代购买按钮，并展示当前持仓风险、潜在赔付和证据入口。

#### Scenario: 已持有 active policy 时展示持仓摘要
- **GIVEN** 当前用户在该航班拥有至少一张 active policy
- **WHEN** Flight Detail 渲染 Insure 区域
- **THEN** 页面 SHALL 展示 active policy count
- **AND** 页面 SHALL 展示 active premium total
- **AND** 页面 SHALL 展示 active potential payout total
- **AND** 页面 SHALL 展示最高风险等级
- **AND** 页面 SHALL 展示 View in Hangar 链接
- **AND** 页面 SHALL NOT 展示 Confirm purchase 按钮

#### Scenario: 持仓摘要提供 Evidence 入口
- **GIVEN** 当前用户在该航班拥有 active policy
- **WHEN** 用户点击持仓摘要中的 Evidence 操作
- **THEN** 页面 SHALL 打开该 policy 的 Evidence Drawer
- **AND** 当前 URL SHALL 保持 `/flight/:id`
- **AND** Drawer 关闭后 SHALL 留在当前 Flight Detail 页面

#### Scenario: 多张 active policy 聚合展示
- **GIVEN** 当前用户在该航班拥有多张 active policies
- **WHEN** Flight Detail 渲染 active holding summary
- **THEN** active premium total SHALL 等于这些 active policies 的 premium 合计
- **AND** active potential payout total SHALL 等于这些 active policies 的 payout 合计
- **AND** 最高风险等级 SHALL 取 `triggered`、`watch`、`unknown`、`normal` 中优先级最高者
- **AND** Evidence 操作 SHALL 默认打开风险等级最高的 active policy timeline
