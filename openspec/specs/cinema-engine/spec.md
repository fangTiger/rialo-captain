## Purpose
Rialo-Captain cinema-engine 能力定义 `/` Cinema 大屏的自动播放、主角编排、用户接管、demo seed、事件编排和 C1 错误处理行为。

## Requirements
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

### Requirement: 用户接管与 Manual 指示
系统 SHALL 在用户主动操作大屏时立即暂停 cinema，并显示 manual 模式与自动恢复倒计时。

#### Scenario: 点击飞机进入 manual
- **GIVEN** 系统处于 cinema 模式
- **WHEN** 用户点击任意飞机
- **THEN** 系统 SHALL 立即进入 interactive 模式
- **AND** `ModeIndicator` SHALL 显示 `MANUAL · 30s`
- **AND** AutoSeeder SHALL 停止当前和后续未执行的 seed/inject timer

#### Scenario: 非接管 hover 不暂停 cinema
- **GIVEN** 系统处于 cinema 模式
- **WHEN** 用户仅 hover 航班或移动鼠标
- **THEN** 系统 SHALL 保持 cinema 模式
- **AND** idle 倒计时 SHALL NOT 启动

### Requirement: idle 自动恢复
系统 SHALL 在 interactive 模式下监控用户 idle 时间，并在 30 秒无接管输入后自动恢复 cinema。

#### Scenario: 30 秒无操作恢复 cinema
- **GIVEN** 用户通过 click、wheel、drag 或 keydown 进入 interactive 模式
- **WHEN** 之后 30 秒内没有新的 click、wheel、drag 或 keydown
- **THEN** 系统 SHALL 自动恢复 cinema 模式
- **AND** 下一次 cinema cycle SHALL 从 establish 阶段重新开始

#### Scenario: manual 倒计时被新输入重置
- **GIVEN** 系统处于 interactive 模式且 `ModeIndicator` 显示剩余 10 秒
- **WHEN** 用户再次 wheel、drag、click 或 keydown
- **THEN** 系统 SHALL 把 idle 倒计时重置为 30 秒

### Requirement: Esc 立即恢复
系统 SHALL 支持在 interactive 模式下按 Esc 立即恢复 cinema。

#### Scenario: Esc 跳过 idle 等待
- **GIVEN** 系统处于 interactive 模式且 auto-resume 仍有剩余时间
- **WHEN** 用户按下 `Escape`
- **THEN** 系统 SHALL 立即恢复 cinema 模式
- **AND** `ModeIndicator` SHALL 不再显示 `MANUAL`
- **AND** AutoSeeder SHALL 允许在新的 cycle 中重新工作

### Requirement: 页面可见性暂停
系统 SHALL 在页面 hidden 时暂停 cinema、camera animation 和 AutoSeeder，并在页面重新 visible 后恢复。

#### Scenario: hidden 暂停自动播放
- **GIVEN** 系统处于 cinema 模式
- **WHEN** `document.visibilityState` 变为 `hidden`
- **THEN** 系统 SHALL 进入 paused-hidden 状态
- **AND** camera animation SHALL 暂停或取消
- **AND** AutoSeeder SHALL NOT 调用 seed-demo 或 inject-delay

#### Scenario: visible 恢复自动播放
- **GIVEN** 系统处于 paused-hidden 状态
- **WHEN** `document.visibilityState` 变为 `visible`
- **THEN** 系统 SHALL 恢复 cinema 模式
- **AND** 新 cycle SHALL 从 establish 阶段开始

### Requirement: AutoSeeder 节奏与节流
系统 SHALL 在 cinema 模式下按 cycle 调用 demo seed 与 delay 注入，并保证每个 cycle 最多 1 次 seed-demo 和 1 次 DEMO inject-delay；DEMO inject-delay SHALL 在 cycle 第 3 秒触发，以支持约 10 秒内完成闭环演示。

#### Scenario: cycle 开头 seed 主角保单
- **GIVEN** cinema 进入新的 establish 阶段
- **WHEN** AutoSeeder 已选择 DEMO 主角和虚拟用户名
- **THEN** 系统 SHALL 调用 `POST /api/seed-demo`
- **AND** request body SHALL 包含 `protagonist_name`
- **AND** AutoSeeder SHALL 把选择出的 DEMO protagonist 写回 `CinemaState`

#### Scenario: 第 3 秒注入延误
- **GIVEN** 当前 DEMO cycle 已成功 seed
- **WHEN** cycle elapsed 为 2999ms
- **THEN** AutoSeeder SHALL NOT 调用 `POST /api/inject-delay`
- **WHEN** cycle elapsed 到达 3000ms 且系统仍处于 cinema 模式
- **THEN** AutoSeeder SHALL 调用 `POST /api/inject-delay`
- **AND** body SHALL 包含 DEMO protagonist 的 `flight_id`
- **AND** body SHALL 包含 demo 延误分钟数

#### Scenario: pause 期间不调用 API
- **GIVEN** 用户进入 interactive 或页面 hidden
- **WHEN** 原本的 seed 或 inject timer 到期
- **THEN** AutoSeeder SHALL 清理 timer
- **AND** AutoSeeder SHALL NOT 调用 `POST /api/seed-demo`
- **AND** AutoSeeder SHALL NOT 调用 `POST /api/inject-delay`

#### Scenario: 单 cycle 不重复调用
- **GIVEN** 当前 cycle 已经调用过 seed-demo 和 DEMO inject-delay
- **WHEN** React 重新渲染或 flights 列表刷新
- **THEN** AutoSeeder SHALL NOT 在同一 cycle 再次调用 seed-demo 或 DEMO inject-delay

### Requirement: REAL 抢占触发完整闭环
系统 SHALL 在 REAL `policy.created` 抢占成为当前 Cinema 主角后，自动且幂等地触发该真实航班的延误注入；`inject-delay` 成功写入后，后端 SHALL 立即运行目标航班的 ClaimEngine 检测，使 `claim.triggered`、`claim.settled` 与 `flight.landed` 可在当前压缩时间线内到达前端。

#### Scenario: REAL 主角立即触发 inject-delay
- **GIVEN** Cinema 当前没有 REAL inject dedup 记录
- **WHEN** 60 秒内的 REAL `policy.created` 事件抢占并成为当前 protagonist
- **THEN** 系统 SHALL 立即调用 `POST /api/inject-delay`
- **AND** 请求 body SHALL 包含当前 REAL protagonist 的 `flight_id`
- **AND** 请求 body SHALL 包含 demo 延误分钟数
- **AND** 系统 SHALL NOT 为该 REAL protagonist 调用 `POST /api/seed-demo`

#### Scenario: inject-delay 成功后立即检测目标航班
- **GIVEN** `/inject-delay` 或 `/admin/inject-delay` 已验证目标 flight 存在
- **WHEN** endpoint 写入该 flight 的 delay override
- **THEN** 后端 SHALL 在返回响应前调用 `ClaimEngine.run_for_flight(flight_id)`
- **AND** `run_for_flight` SHALL 只扫描该 flight 的 ACTIVE policy
- **AND** 现有 30 秒后台 `ClaimEngine.run_once()` SHALL 继续保留

#### Scenario: REAL inject 后沿用现有 C2 闭环事件链
- **GIVEN** REAL protagonist 的 inject-delay 请求已成功
- **WHEN** 后端 ClaimEngine 检测到该真实保单满足延误条件并广播事件
- **THEN** 前端 SHALL 通过现有 EventChoreographer 消费 `claim.triggered`
- **AND** 前端 SHALL 通过现有 EventChoreographer 消费 `claim.settled`
- **AND** 前端 SHALL 通过现有 EventChoreographer 消费 `flight.landed`
- **AND** 系统 SHALL NOT 在前端伪造 `claim.triggered`、`claim.settled` 或 `flight.landed`

#### Scenario: 同一 REAL 主角重复渲染不重复 inject
- **GIVEN** 当前 REAL protagonist 已经触发过 inject-delay
- **AND** dedup key 由 `cycleId`、`flight_id` 与 `policy_id` 或等价事件 id 组成
- **WHEN** React 重新渲染、EventChoreographer effect 重新执行或相同 WS payload 重复到达
- **THEN** 系统 SHALL NOT 再次调用 `POST /api/inject-delay` 给同一个 REAL protagonist
- **AND** DEMO cycle 的 inject-delay 节流 SHALL 保持独立

#### Scenario: REAL burst 中每个成为主角的事件各自 inject
- **GIVEN** 第一条 REAL `policy.created` 已经立即抢占并触发 inject-delay
- **WHEN** 1 秒内第二条 REAL `policy.created` 到达并进入 REAL queue
- **THEN** 系统 SHALL NOT 立即为第二条 queued REAL 调用 inject-delay
- **WHEN** queued REAL 在后续 cycle 成为当前 protagonist
- **THEN** 系统 SHALL 为该 queued REAL 调用一次 `POST /api/inject-delay`
- **AND** 每条成为当前 protagonist 的 REAL SHALL 使用自己的 dedup key

#### Scenario: REAL inject 失败显示短暂提示
- **GIVEN** 当前 protagonist 为 REAL
- **WHEN** `POST /api/inject-delay` 返回 4xx、5xx 或网络错误
- **THEN** `ModeIndicator` SHALL 显示 `REAL · INJECT FAILED`
- **AND** 该提示 SHALL 短暂显示后自动清除
- **AND** 系统 SHALL NOT 阻塞用户 click、wheel、drag、keydown 或 Esc 接管/恢复
- **AND** 系统 SHALL NOT 在同一 dedup key 下重复刷请求

### Requirement: 主角选择与真实事件抢占
系统 SHALL 使用 Spotlight Hybrid 选择主角：真实事件优先，DEMO 主角兜底；没有真实事件时，DEMO 主角 SHALL 在可用候选航班中轮转，不得固定同一架，候选耗尽后再循环；REAL `policy.created` 在任意 phase 到达时 SHALL 立即清场抢占当前故事，但 1 秒内的 REAL burst SHALL 只切换第一个事件，其余按 FIFO 入队。

#### Scenario: 没有真实事件时选择轮转 DEMO 主角
- **GIVEN** 60 秒内没有可用真实事件
- **AND** live flights 中存在多架可定位且 `on_ground=false` 的候选航班
- **WHEN** cinema cycle 进入 establish 阶段
- **THEN** 系统 SHALL 从候选航班中选择 DEMO 主角
- **AND** 每个 cycle SHALL 选择不同候选直到候选耗尽后再从头循环
- **AND** 页面挂载时的首次 DEMO 选择 SHALL 使用不持久化的 session-only seed，避免刷新后总是固定第一架
- **AND** `CinemaState.protagonist`、`ProtagonistBadge`、`GlobeMap` 主角高亮与 AutoSeeder seed-demo 使用的主角 SHALL 保持一致
- **AND** `ProtagonistBadge` SHALL 显示 `DEMO`

#### Scenario: DEMO 轮转跳过不可用候选
- **GIVEN** live flights 中包含落地航班、缺少经纬度航班或 ETA 不适合的航班
- **WHEN** 系统为 DEMO cycle 选择主角
- **THEN** 系统 SHALL 跳过不可用候选
- **AND** 轮转顺序 SHALL 只在可定位且 `on_ground=false` 且 ETA 可用的候选之间计算

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

### Requirement: KPI tick 事件编排
系统 SHALL 在 C1 中把 settlement 类事件路由到 KPI tick，在 C2 中把闭环关键事件路由到 ShockWave、ChainBeam、FlareLand，并在 C3 中把 ambient 事件与 STORY phase 路由到 HeatmapBg、TrailDraw，使 C1/C2/C3 的 8 个 cinema 动效均可按各自范围渲染。

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

#### Scenario: TrailDraw 窗口渲染主角航迹
- **GIVEN** cinema cycle 进入 TrailDraw 窗口且当前 protagonist 可投影
- **WHEN** 当前实现范围包含 C3
- **THEN** TowerShell SHALL 触发 TrailDraw
- **AND** TrailDraw SHALL NOT 由 `claim.triggered`、`claim.settled` 或 `flight.landed` 直接触发

### Requirement: Radar AT RISK 高亮
系统 SHALL 在主角航班进入 story at-risk 窗口时在 RadarSweep 层显示 `AT RISK` 高亮。

#### Scenario: 主角 story 阶段显示 AT RISK
- **GIVEN** 系统处于 cinema 模式且已有主角航班
- **WHEN** cycle 处于 story 阶段的 at-risk 时间窗
- **THEN** `RadarSweep` SHALL 显示 `AT RISK`
- **AND** 高亮 SHALL 与主角 badge 同时可见

#### Scenario: 非 at-risk 阶段不显示标签
- **GIVEN** 系统处于 establish、zoom-in、zoom-out 或 rest 阶段
- **WHEN** `RadarSweep` 渲染
- **THEN** `RadarSweep` SHALL NOT 显示 `AT RISK`

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

### Requirement: demo API 安全入口
系统 SHALL 提供前端可调用的 demo seed/inject 入口，且不得把 admin token 暴露给浏览器；public 与 admin inject-delay 入口均 SHALL 在成功写入 delay 后立即触发目标航班 ClaimEngine 检测。

#### Scenario: seed-demo 支持 protagonist_name
- **GIVEN** AutoSeeder 选择了主角姓名
- **WHEN** 调用 `POST /api/seed-demo`
- **THEN** 后端 SHALL 接受 `protagonist_name`
- **AND** 响应 SHALL 包含已创建的 demo policy 与主角 flight id

#### Scenario: 浏览器不携带 ADMIN_TOKEN
- **GIVEN** 前端运行在浏览器
- **WHEN** 它调用 seed-demo 或 inject-delay
- **THEN** 它 SHALL 使用不带 token 的 `/api/seed-demo` 与 `/api/inject-delay`
- **AND** 现有 `/api/admin/seed-demo` 与 `/api/admin/inject-delay` SHALL 继续要求 `X-Admin-Token`

#### Scenario: inject-delay 成功后立即运行目标航班检测
- **GIVEN** `/api/inject-delay` 或 `/api/admin/inject-delay` 收到已存在 flight 的请求
- **WHEN** 后端保存 delay override
- **THEN** 后端 SHALL 调用 `ClaimEngine.run_for_flight(flight_id)`
- **AND** response body SHALL 保持现有 `flight_id` 与 `delay_minutes` shape
- **AND** ClaimEngine SHALL 输出 INFO 日志用于现场 tail 验证

#### Scenario: demo 入口关闭时返回可处理错误
- **GIVEN** demo/autoseed 开关关闭
- **WHEN** 浏览器调用 `/api/seed-demo` 或 `/api/inject-delay`
- **THEN** 后端 SHALL 返回 403 或 503
- **AND** 前端 SHALL 进入 `DEMO · OFFLINE` 或 degraded 可见状态
- **AND** 后端 SHALL NOT 调用 `ClaimEngine.run_for_flight`

### Requirement: claim.settled payload 扩展
系统 SHALL 在自动赔付结算后广播 `claim.settled`，payload 包含 mock 链字段，并继续广播现有 `flare` 事件。

#### Scenario: settlement 广播包含 mock tx 字段
- **GIVEN** ClaimEngine 触发赔付并创建 Claim
- **WHEN** 后端广播 settlement
- **THEN** WebSocket SHALL 广播 `claim.settled`
- **AND** payload SHALL 包含 `tx_hash`
- **AND** payload SHALL 包含 `block_height`
- **AND** `tx_hash` SHALL 是 `0x` 前缀的 40 hex mock hash
- **AND** `block_height` SHALL 是递增整数

#### Scenario: 兼容 flare 继续广播
- **GIVEN** ClaimEngine 触发赔付并创建 Claim
- **WHEN** 后端广播 settlement
- **THEN** WebSocket SHALL 继续广播现有 `flare` 事件
- **AND** 现有 flare payload 字段 SHALL 保持兼容

### Requirement: flight.landed 事件发射
系统 SHALL 在 demo 闭环结算后发射 `flight.landed` 事件，供 C2 后续接入 FlareLand。

#### Scenario: 结算后发射 landed 事件
- **GIVEN** ClaimEngine 已广播 `claim.settled`
- **WHEN** 当前 demo 闭环进入落地阶段
- **THEN** WebSocket SHALL 广播 `flight.landed`
- **AND** payload SHALL 包含 `flight_id`、`policy_id`、`landed_at` 和 `source`

### Requirement: degraded 与错误处理
系统 SHALL 对无航班、API 失败、WS 断连和旧事件等边界情况显示可见状态，并避免无限重试或污染用户操作。

#### Scenario: 无可用航班时等待重试
- **GIVEN** live flights 为空或没有可定位且未落地的航班
- **WHEN** cinema cycle 需要选择主角
- **THEN** 系统 SHALL 不调用 seed-demo
- **AND** `ModeIndicator` SHALL 显示等待航班的 cinema 状态
- **AND** 系统 SHALL 在后续 cycle 或 10 秒后重试

#### Scenario: seed-demo 失败时离线降级
- **GIVEN** AutoSeeder 调用 `POST /api/seed-demo`
- **WHEN** 后端返回 503 或网络错误
- **THEN** 当前 cycle SHALL 标记为 `DEMO · OFFLINE`
- **AND** KPI SHALL NOT 因纯前端 mock 主角改变
- **AND** AutoSeeder SHALL NOT 在同一 cycle 重复调用 seed-demo

#### Scenario: WS 断连时显示数据链路丢失
- **GIVEN** `eventStore.wsState` 从 `open` 变为 `retrying` 或 `closed`
- **WHEN** TowerShell 渲染
- **THEN** `ModeIndicator` SHALL 显示 `DATA LINK LOST · retry`
- **AND** WebSocket 重连后系统 SHALL 恢复 cinema 或保持用户接管状态

#### Scenario: 旧真实事件不进入主角队列
- **GIVEN** WebSocket 收到 `policy.created` 真实事件
- **WHEN** 事件时间戳距当前墙钟超过 60 秒
- **THEN** 系统 SHALL NOT 将其加入 REAL 主角队列
