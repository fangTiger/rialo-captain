## MODIFIED Requirements

### Requirement: KPI tick 事件编排
系统 SHALL 在 C1 中把 settlement 类事件路由到 KPI tick，并在 C2 中把闭环关键事件路由到 ShockWave、ChainBeam、FlareLand；C3 动效仍不得渲染。

#### Scenario: claim.settled 触发 KPI tick
- **GIVEN** WebSocket 收到 `claim.settled` 事件
- **WHEN** payload 包含 `payout`、`policy_id` 和 `flight_id`
- **THEN** `EventChoreographer` SHALL 触发一次 KPI tick
- **AND** `KPIBand` SHALL 以动画方式更新 session settled 数和 payout

#### Scenario: 兼容 flare 事件触发 KPI tick
- **GIVEN** WebSocket 收到现有 `flare` 事件
- **WHEN** payload 符合当前 FlareEvent schema
- **THEN** `EventChoreographer` SHALL 将其视为 settlement 事件触发 KPI tick
- **AND** 现有 Claims Feed 与 Hangar revalidation 行为 SHALL 保持兼容

#### Scenario: C2 事件渲染关键时刻动效
- **GIVEN** WebSocket 收到当前主角相关的 `claim.triggered`、`claim.settled` 或 `flight.landed`
- **WHEN** 当前实现范围包含 C2
- **THEN** `EventChoreographer` SHALL 路由 `claim.triggered` 到 ShockWave
- **AND** `EventChoreographer` SHALL 路由 `claim.settled` 到 ChainBeam
- **AND** `EventChoreographer` SHALL 路由 `flight.landed` 到 FlareLand

#### Scenario: C3 事件仍不渲染视觉动效
- **GIVEN** WebSocket 收到 C3 相关事件或 policy heatmap/trail 数据
- **WHEN** 当前实现范围为 C2
- **THEN** 系统 SHALL NOT 渲染 HeatmapBg 或 TrailDraw
- **AND** C2 实现 SHALL NOT 引入 ShockWave、ChainBeam、FlareLand 以外的新增动效

### Requirement: CinemaOverlay 挂载点
系统 SHALL 提供 `CinemaOverlay` 作为 C2/C3 动效挂载点；C2 中该容器 SHALL 承载 ShockWave、ChainBeam、FlareLand 与 C1 badge，但不得阻挡地图交互。

#### Scenario: Overlay 随 TowerShell 挂载
- **GIVEN** 用户打开 `/`
- **WHEN** `TowerShell` 渲染 cinema 大屏
- **THEN** 页面 SHALL 包含 `CinemaOverlay` 挂载容器
- **AND** 该容器 SHALL 不阻挡地图点击、hover、wheel 或 drag

#### Scenario: Overlay 承载 C2 key moments
- **GIVEN** C2 key moment 已由 EventChoreographer 路由
- **WHEN** `CinemaOverlay` 渲染
- **THEN** 该容器 SHALL 能承载 ShockWave、ChainBeam 或 FlareLand
- **AND** ProtagonistBadge SHALL 继续在 overlay 中可见
