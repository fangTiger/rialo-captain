## MODIFIED Requirements

### Requirement: Guided Demo 购买后导演式闭环
系统 SHALL 在 Guided Demo 购买成功后，把购买结果路由为 REAL protagonist，并沿用现有购买后压缩时间线播放 TrailDraw、ShockWave、ChainBeam 和 FlareLand。系统 MUST 先消费真实 WebSocket 事件；缺少真实事件时，才允许使用现有 fallback visual event 保障演示闭环。系统 SHALL 支持用户显式重放该 demo visual timeline。

#### Scenario: 购买成功路由 REAL protagonist
- **GIVEN** Guided Demo 用户已成功购买 policy `P1`
- **AND** 被购买航班有可投影坐标
- **WHEN** TowerShell 处理购买结果
- **THEN** Cinema SHALL 调用 REAL protagonist 路由
- **AND** protagonist SHALL 包含 policy id、flight id、callsign 和坐标
- **AND** playback lock SHALL 保持足够长以播放购买后闭环

#### Scenario: fallback 事件保持幂等
- **GIVEN** Guided Demo 购买后的真实 `claim.triggered`、`claim.settled` 或 `flight.landed` 事件已经到达
- **WHEN** 购买后 fallback 时间点到达
- **THEN** 系统 SHALL NOT 重复创建相同 policy 的 fallback visual event
- **AND** KPI tick、ChainBeam 和 FlareLand SHALL 不因重复 payload 额外计数

#### Scenario: 用户重放 demo visual timeline
- **GIVEN** Guided Demo 已有 purchased policy `P1`
- **WHEN** 用户点击 `Replay settlement`
- **THEN** Cinema SHALL 重新播放 TrailDraw、ShockWave、ChainBeam 和 FlareLand demo visual timeline
- **AND** 重放 SHALL 使用同一 flight、policy、premium 和 payout 上下文
- **AND** 重放 SHALL NOT 创建新的 policy、claim、balance update 或真实链上交易

#### Scenario: 重放期间切换手动视角不取消 demo
- **GIVEN** 用户触发了 `Replay settlement`
- **WHEN** 用户拖拽、缩放地图或触发 manual viewing
- **THEN** Cinema SHALL 按既有规则进入 manual 状态
- **AND** replay timers SHALL 按幂等规则继续或安全完成
- **AND** Guided Demo Rail SHALL 保留当前 purchased policy

#### Scenario: 缺少坐标时不崩溃
- **GIVEN** Guided Demo 用户已成功购买 policy
- **AND** 被购买航班缺少可投影坐标
- **WHEN** TowerShell 尝试路由购买后闭环
- **THEN** 系统 SHALL 保持 Demo Rail 可见
- **AND** 系统 SHALL NOT 抛出运行时错误
- **AND** 用户 SHALL 可以退出演示或选择其它航班
