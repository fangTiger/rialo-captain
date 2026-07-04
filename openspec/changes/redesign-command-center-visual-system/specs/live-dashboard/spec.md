## ADDED Requirements

### Requirement: Tower 电影雷达与预测风控 HUD
Tower 首页 SHALL 采用 Command Center 主视觉：天气风险层呈现电影感航空雷达，预测市场 HUD 呈现专业风控终端。天气与预测信号 MUST 仍为只读上下文，不得触发购买、赔付、交易、Copilot 调用或路由跳转。

#### Scenario: 天气风险更直观
- **GIVEN** 用户打开 Tower 首页且天气层开启
- **WHEN** GlobeMap 渲染天气风险
- **THEN** 页面 SHALL 展示多层天气视觉，包括全球 storm mass、severe cell pulse、forecast band、active corridor 和 corridor intercept marker
- **AND** 最高风险段 SHALL 有可读标签说明天气压力或风险贡献

#### Scenario: 预测 HUD 展示分歧仪表
- **GIVEN** Tower 有 active subject
- **WHEN** Risk Intelligence HUD 渲染
- **THEN** HUD SHALL 展示 market odds、market implied probability、Rialo model probability、model-vs-market divergence meter、confidence、forecast window 和 signal-only 边界
- **AND** HUD SHALL 展示至少一个 weather contribution 或 pressure contribution 解释

#### Scenario: Odds ticker 展示多主体风险
- **GIVEN** Tower 有多个 live flights
- **WHEN** Risk Intelligence HUD 渲染
- **THEN** HUD SHALL 展示一个只读 odds ticker 或 compact watchlist
- **AND** ticker 项 SHALL 包含 callsign、odds 或 probability、方向/压力提示
- **AND** 点击或查看 ticker 不得创建交易、保单、赔付或余额变更

#### Scenario: Tower 交互边界保持
- **GIVEN** 用户切换天气层、查看预测 HUD 或与视觉层交互
- **WHEN** 这些操作发生
- **THEN** CinemaProvider SHALL 不被重挂载
- **AND** BuyDrawer SHALL 不被意外打开
- **AND** Copilot ask SHALL 不被触发
- **AND** URL SHALL 保持当前预期路由

### Requirement: 运营页面终端化信息密度
My Hangar、Flight Detail、Claims Feed、Hot Routes 和 Rialo Inside SHALL 使用 Command Center 终端风格展示风险、敞口、赔付、航线和系统结构，提升信息维度但保持现有导航语义。

#### Scenario: My Hangar 展示风险敞口维度
- **WHEN** 用户访问 `/policies`
- **THEN** 页面 SHALL 以终端化 summary 和 lanes 展示 active exposure、max payout、settled payout、at-risk count、highest risk、freshness 或 live signal 状态
- **AND** active policy 卡片 SHALL 保持整卡可点和 Evidence/Copilot 行为

#### Scenario: Flight Detail 展示单航班风险决策面板
- **WHEN** 用户访问 `/flight/:id`
- **THEN** 页面 SHALL 展示单航班 Command Center hero、风险 KPI、天气/市场上下文、购买决策和相关证据入口
- **AND** 当前用户已有 active policy 时仍按既有规则禁用重复购买

#### Scenario: Claims Feed 展示赔付态势
- **WHEN** 用户访问 `/claims`
- **THEN** 页面 SHALL 展示赔付态势、近期 claim、settlement status、evidence availability 和 route/flight risk context
- **AND** ClaimRow 整行导航行为 SHALL 保持不变
