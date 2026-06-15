## ADDED Requirements

### Requirement: 默认 Cinema 自动播放
系统 SHALL 在用户打开 `/` 并完成登录后默认进入 cinema 模式，按 30 秒 cycle 自动推进 `establish`、`zoom-in`、`story`、`zoom-out`、`rest` 阶段，并在无人操作时持续循环。

#### Scenario: 5 秒后自动 zoom 到主角航班
- **GIVEN** 用户打开 `/` 且页面可见，live flights 中存在至少一架可定位且未落地的航班
- **WHEN** 用户 5 秒内没有 click、wheel、drag 或 keydown 操作
- **THEN** 系统 SHALL 选出一个 DEMO 主角航班并把 camera target 设置为该航班坐标
- **AND** `GlobeMap` SHALL 从第 5 秒开始 zoom 到主角航班
- **AND** `ModeIndicator` SHALL 显示 cinema 状态

#### Scenario: 30 秒 cycle 循环
- **GIVEN** 系统处于 cinema 模式且未被用户接管
- **WHEN** 一个 cycle 到达第 30 秒
- **THEN** 系统 SHALL 开始新的 cycle
- **AND** 新 cycle SHALL 重新执行主角选择、seed 节流和 camera 时间线

### Requirement: CameraDirector 与 GlobeMap viewport 整合
系统 SHALL 通过 `cameraTarget` 控制现有 `GlobeMap` viewport，不引入新的地图框架，也不得破坏当前 hover、点击导航、滚轮缩放和拖拽行为。

#### Scenario: cameraTarget 驱动现有 viewport
- **GIVEN** `CameraDirector` 产生包含经纬度、zoom 与 duration 的 `cameraTarget`
- **WHEN** `GlobeMap` 接收到该 target
- **THEN** `GlobeMap` SHALL 使用现有 SVG viewport 状态插值到目标位置
- **AND** viewport 更新 SHALL 保持航班点、地理网格和 tooltip 使用同一投影坐标系

#### Scenario: 用户手势取消自动镜头
- **GIVEN** `GlobeMap` 正在执行 cinema camera 动画
- **WHEN** 用户 wheel、drag 或 click 任意飞机
- **THEN** `GlobeMap` SHALL 取消当前 camera 动画
- **AND** `CinemaController` SHALL 进入 interactive 模式

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
系统 SHALL 在 cinema 模式下按 cycle 调用 demo seed 与 delay 注入，并保证每个 cycle 最多 1 次 seed-demo 和 1 次 inject-delay。

#### Scenario: cycle 开头 seed 主角保单
- **GIVEN** 系统处于 cinema 模式且 cycle 进入 establish 阶段
- **WHEN** AutoSeeder 已选择 DEMO 主角和虚拟用户名
- **THEN** AutoSeeder SHALL 调用 `POST /api/seed-demo`
- **AND** 请求 body SHALL 包含 `protagonist_name`
- **AND** 成功响应 SHALL 返回主角 `flight_id` 和至少一个 `policy_id`

#### Scenario: 第 12 秒注入延误
- **GIVEN** 当前 cycle 的 seed-demo 已成功且返回主角 `flight_id`
- **WHEN** cycle 到达第 12 秒且系统仍处于 cinema 模式
- **THEN** AutoSeeder SHALL 调用 `POST /api/inject-delay`
- **AND** 请求 body SHALL 包含该主角 `flight_id` 和 demo 延误分钟数

#### Scenario: pause 期间不调用 API
- **GIVEN** 系统处于 interactive 或 paused-hidden 状态
- **WHEN** 原本的 seed 或 inject timer 到期
- **THEN** AutoSeeder SHALL NOT 调用 `POST /api/seed-demo`
- **AND** AutoSeeder SHALL NOT 调用 `POST /api/inject-delay`

#### Scenario: 单 cycle 不重复调用
- **GIVEN** 当前 cycle 已经调用过 seed-demo 和 inject-delay
- **WHEN** React 重新渲染或 WebSocket 事件到达
- **THEN** AutoSeeder SHALL NOT 在同一 cycle 再次调用 seed-demo 或 inject-delay

### Requirement: 主角选择与真实事件抢占
系统 SHALL 使用 Spotlight Hybrid 选择主角：真实事件优先，DEMO 主角兜底，并按 phase 决定是否立即抢占。

#### Scenario: 没有真实事件时选择 DEMO 主角
- **GIVEN** 60 秒内没有可用真实事件
- **WHEN** cinema cycle 进入 establish 阶段
- **THEN** 系统 SHALL 从 live flights 中选择可定位且 `on_ground=false` 的航班作为 DEMO 主角
- **AND** `ProtagonistBadge` SHALL 显示 `DEMO`

#### Scenario: establish 或 rest 阶段真实事件立即抢占
- **GIVEN** 系统处于 establish 或 rest 阶段
- **WHEN** 60 秒内的 `policy.created` 真实事件到达且可映射到航班
- **THEN** 系统 SHALL 把该事件设为 REAL 主角
- **AND** `ProtagonistBadge` SHALL 显示 `REAL · LIVE`

#### Scenario: story 阶段真实事件排队
- **GIVEN** 系统处于 story 阶段且正在播放 DEMO 主角
- **WHEN** 60 秒内的真实事件到达
- **THEN** 系统 SHALL 保持当前故事不中断
- **AND** 系统 SHALL 把真实事件加入下一 cycle 的优先队列

#### Scenario: 真实队列容量与堆积显示
- **GIVEN** REAL 主角队列已包含 3 条待播事件
- **WHEN** 第 4 条真实事件到达
- **THEN** 系统 SHALL 限制队列最多保留 3 条可播放事件
- **AND** `ProtagonistBadge` SHALL 显示堆积数量提示

### Requirement: KPI tick 事件编排
系统 SHALL 在 C1 中只把 settlement 类事件路由到 KPI tick，不渲染 C2/C3 动效。

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

#### Scenario: C2/C3 事件不渲染视觉动效
- **GIVEN** WebSocket 收到 `claim.triggered` 或 `flight.landed`
- **WHEN** 当前实现范围为 C1
- **THEN** `CinemaOverlay` SHALL 保持为空容器或仅渲染 C1 badge
- **AND** 系统 SHALL NOT 渲染 ShockWave、ChainBeam、FlareLand、HeatmapBg 或 TrailDraw

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
系统 SHALL 提供 `CinemaOverlay` 作为未来 C2/C3 动效挂载点，但 C1 不得实现这些动效。

#### Scenario: 空容器随 TowerShell 挂载
- **GIVEN** 用户打开 `/`
- **WHEN** `TowerShell` 渲染 cinema 大屏
- **THEN** 页面 SHALL 包含 `CinemaOverlay` 挂载容器
- **AND** 该容器 SHALL 不阻挡地图点击、hover、wheel 或 drag

### Requirement: demo API 安全入口
系统 SHALL 提供前端可调用的 demo seed/inject 入口，且不得把 admin token 暴露给浏览器。

#### Scenario: seed-demo 支持 protagonist_name
- **GIVEN** AutoSeeder 调用 `POST /api/seed-demo`
- **WHEN** 请求 body 包含 `protagonist_name`
- **THEN** 后端 SHALL 使用该名称创建或选择 demo 用户展示信息
- **AND** 响应 SHALL 包含 `protagonist_name`、`flight_id`、`policies_created`、`claims_settled` 和主角 `policy_ids`

#### Scenario: 浏览器不携带 ADMIN_TOKEN
- **GIVEN** AutoSeeder 从前端运行
- **WHEN** 它调用 seed-demo 或 inject-delay
- **THEN** 请求 SHALL NOT 依赖前端内置的 `ADMIN_TOKEN`
- **AND** 现有 `/api/admin/seed-demo` 与 `/api/admin/inject-delay` SHALL 继续要求 `X-Admin-Token`

#### Scenario: demo 入口关闭时返回可处理错误
- **GIVEN** cinema demo seed 功能被配置关闭
- **WHEN** AutoSeeder 调用 `POST /api/seed-demo`
- **THEN** 后端 SHALL 返回非 2xx 错误
- **AND** 前端 SHALL 进入 `DEMO · OFFLINE` 或 degraded 可见状态

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
