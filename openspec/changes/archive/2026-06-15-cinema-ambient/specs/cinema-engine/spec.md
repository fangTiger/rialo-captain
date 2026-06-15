## MODIFIED Requirements

### Requirement: KPI tick 事件编排
系统 SHALL 在 C1 中把 settlement 类事件路由到 KPI tick，在 C2 中把闭环关键事件路由到 ShockWave、ChainBeam、FlareLand，并在 C3 中把 ambient 事件与 STORY phase 路由到 HeatmapBg、TrailDraw。

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

#### Scenario: C3 事件渲染氛围动效
- **GIVEN** WebSocket 收到含可投影坐标的 `policy.created`
- **WHEN** 当前实现范围包含 C3
- **THEN** `EventChoreographer` SHALL 路由该事件给 HeatmapBg 数据收集器
- **AND** `EventChoreographer` SHALL 继续按 C1 规则处理 REAL 主角队列

#### Scenario: STORY phase 渲染 TrailDraw
- **GIVEN** cinema cycle 进入 STORY phase 且当前 protagonist 可投影
- **WHEN** 当前实现范围包含 C3
- **THEN** TowerShell SHALL 触发 TrailDraw
- **AND** TrailDraw SHALL NOT 由 `claim.triggered`、`claim.settled` 或 `flight.landed` 直接触发

### Requirement: CinemaOverlay 挂载点
系统 SHALL 提供 `CinemaOverlay` 作为 C2 key moments 与 C3 TrailDraw 的上层挂载点，并在 TowerShell 中提供 HeatmapBg 地图底层氛围挂载层；这些层均不得阻挡地图交互。

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

#### Scenario: Overlay 承载 C3 TrailDraw
- **GIVEN** cinema 进入 STORY phase 且当前 protagonist 可投影
- **WHEN** `CinemaOverlay` 渲染
- **THEN** 该容器 SHALL 能承载 TrailDraw
- **AND** TrailDraw SHALL 位于 C2 key moments 下方

#### Scenario: HeatmapBg 使用地图底层氛围层
- **GIVEN** TowerShell 渲染 GlobeMap
- **WHEN** C3 ambient layer 挂载
- **THEN** HeatmapBg SHALL 位于 GlobeMap 视觉底层或等价的低层级氛围层
- **AND** HeatmapBg SHALL NOT 拦截地图交互
