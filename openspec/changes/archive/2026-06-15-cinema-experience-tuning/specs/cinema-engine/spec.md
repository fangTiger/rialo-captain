## MODIFIED Requirements

### Requirement: 默认 Cinema 自动播放
系统 SHALL 在用户打开 `/` 并完成登录后默认进入 cinema 模式，按 30 秒 cycle 自动推进 `establish`、`zoom-in`、`story`、`zoom-out`、`rest` 阶段，并在无人操作时持续循环；自动播放 SHALL 保持全球视图，不再把地图 viewport zoom 到主角航班。

#### Scenario: 5 秒后自动标记主角航班高亮
- **GIVEN** 用户打开 `/` 且页面可见，live flights 中存在至少一架可定位且未落地的航班
- **WHEN** 用户 5 秒内没有 click、wheel、drag 或 keydown 操作
- **THEN** 系统 SHALL 选出一个 DEMO 主角航班
- **AND** `GlobeMap` SHALL 保持全球 viewport，不执行自动 zoom 或 pan
- **AND** 主角航班点 SHALL 显示视觉高亮标识
- **AND** `ModeIndicator` SHALL 显示 cinema 状态

#### Scenario: 30 秒 cycle 循环
- **GIVEN** 系统处于 cinema 模式且未被用户接管
- **WHEN** 一个 cycle 到达第 30 秒
- **THEN** 系统 SHALL 开始新的 cycle
- **AND** 新 cycle SHALL 重新执行主角选择、seed 节流和 spotlight 高亮时间线
- **AND** 新 cycle SHALL NOT 因自动播放改变 `GlobeMap` viewport

### Requirement: CameraDirector 与 GlobeMap viewport 整合
系统 SHALL 保留 `CameraDirector` 与 `GlobeMap.cameraTarget` 的兼容接口，但默认 cinema 自动播放 SHALL 使用 spotlight 高亮目标而不是 viewport zoom/pan；不得破坏当前 hover、点击导航、滚轮缩放和拖拽行为。

#### Scenario: protagonistHighlight 驱动主角视觉标识
- **GIVEN** Cinema state 有当前 protagonist 且 phase 到达 spotlight 展示窗口
- **WHEN** `TowerShell` 渲染 `GlobeMap`
- **THEN** `GlobeMap` SHALL 接收当前 protagonist highlight 信息
- **AND** 与 protagonist 匹配的飞机点 SHALL 带有 `data-protagonist="true"` 或等价可测标识
- **AND** 高亮 SHALL 使用现有地图投影和当前 viewport 位置

#### Scenario: CameraDirector 默认不驱动 viewport
- **GIVEN** Cinema 自动播放进入 `zoom-in`、`story` 或 `zoom-out`
- **WHEN** `CameraDirector` 渲染 children
- **THEN** `CameraDirector` SHALL 默认输出 `cameraTarget = null`
- **AND** `GlobeMap` SHALL NOT 自动插值到 `scale(5)` 或任何主角 zoom viewport
- **AND** `cameraTarget` prop SHALL 保留以兼容未来恢复 zoom 的实现

#### Scenario: 用户手势取消高亮过渡并进入 manual
- **GIVEN** 系统处于 cinema 模式且主角高亮 enter/exit 过渡正在播放
- **WHEN** 用户 wheel、drag、keydown 或 click 任意飞机
- **THEN** `CinemaController` SHALL 进入 interactive 模式
- **AND** `GlobeMap` SHALL 保持用户当前 viewport
- **AND** 自动 spotlight 过渡 SHALL 不再强制覆盖用户操作

### Requirement: 主角选择与真实事件抢占
系统 SHALL 使用 Spotlight Hybrid 选择主角：真实事件优先，DEMO 主角兜底；REAL `policy.created` 在任意 phase 到达时 SHALL 立即清场抢占当前故事，但 1 秒内的 REAL burst SHALL 只切换第一个事件，其余按 FIFO 入队。

#### Scenario: 没有真实事件时选择 DEMO 主角
- **GIVEN** 60 秒内没有可用真实事件
- **WHEN** cinema cycle 进入 establish 阶段
- **THEN** 系统 SHALL 从 live flights 中选择可定位且 `on_ground=false` 的航班作为 DEMO 主角
- **AND** `ProtagonistBadge` SHALL 显示 `DEMO`

#### Scenario: 任意 phase 真实事件立即清场抢占
- **GIVEN** 系统处于 establish、zoom-in、story、zoom-out 或 rest 任意阶段
- **WHEN** 60 秒内的 `policy.created` 真实事件到达且可映射到航班
- **THEN** 系统 SHALL 立即把该事件设为 REAL 主角
- **AND** `ProtagonistBadge` SHALL 显示 `REAL · LIVE`
- **AND** 当前 DEMO 主角 SHALL 不再继续播放

#### Scenario: REAL 抢占时重置 cycle
- **GIVEN** REAL `policy.created` 事件触发立即抢占
- **WHEN** Cinema state 应用该事件
- **THEN** `cycleStartedAt` SHALL 重置为当前墙钟时间
- **AND** `phase` SHALL 设置为 `establish`
- **AND** `cameraTarget` SHALL 设置为 `null`
- **AND** 后续 STORY 时间窗 SHALL 以新 REAL 主角和新 cycle 为准

#### Scenario: REAL 抢占时清空 transient moments
- **GIVEN** C2 key moments 或 C3 TrailDraw 当前存在 active 或 pending visual moments
- **WHEN** REAL `policy.created` 事件立即抢占当前故事
- **THEN** 系统 SHALL 清空 key moment queue 的 active 与 pending moments
- **AND** ShockWave、ChainBeam、FlareLand 和 TrailDraw 旧 DOM SHALL 从 CinemaOverlay 移除
- **AND** 业务事件 ring buffer SHALL 保留原始事件记录

#### Scenario: REAL burst 1 秒内只切第一个
- **GIVEN** 第一条 REAL `policy.created` 事件已经立即抢占当前故事
- **WHEN** 1 秒内又收到一条或多条可映射 REAL `policy.created` 事件
- **THEN** 系统 SHALL 保持第一条 REAL 事件作为当前 protagonist
- **AND** 后续 REAL 事件 SHALL 按 FIFO 加入真实事件队列
- **AND** 队列容量与堆积提示 SHALL 继续遵守现有规则

#### Scenario: 真实队列容量与堆积显示
- **GIVEN** REAL 主角队列已包含 3 条待播事件
- **WHEN** 第 4 条真实事件到达且未触发立即抢占
- **THEN** 系统 SHALL 限制队列最多保留 3 条可播放事件
- **AND** `ProtagonistBadge` SHALL 显示堆积数量提示

### Requirement: CinemaOverlay 挂载点
系统 SHALL 提供 `CinemaOverlay` 作为 C2 key moments 与 C3 TrailDraw 的上层挂载点，并在 TowerShell 中提供 HeatmapBg 地图底层氛围挂载层；这些层均不得阻挡地图交互，且在 REAL 抢占时 SHALL 支持清空旧 transient visual moments。

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

#### Scenario: REAL 抢占清空 overlay transient 动效
- **GIVEN** CinemaOverlay 中存在 ShockWave、ChainBeam、FlareLand 或 TrailDraw
- **WHEN** REAL `policy.created` 事件立即抢占
- **THEN** CinemaOverlay SHALL 移除旧 transient 动效节点
- **AND** ProtagonistBadge SHALL 立即展示新的 REAL 主角
