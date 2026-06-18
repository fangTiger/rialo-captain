## Context

C1 已完成 `CinemaProvider`、`CinemaController`、`AutoSeeder`、`EventChoreographer`、`CinemaOverlay`、`CameraDirector`、`ModeIndicator`、`ProtagonistBadge`，并让 `useWebSocket` 把 `claim.settled`、`policy.created`、`flight.landed`、`claim.triggered` 写入 typed event ring buffer。C1 还把 `claim.settled` / `flare` 路由到 KPI tick，并在 `CinemaOverlay` 中只挂了 ProtagonistBadge。

后端现状是 `ClaimEngine` 条件命中后广播 `flare`、`claim.settled`、`flight.landed`，但没有 `claim.triggered` enum 或广播。C2 只需要补这个触发事件，不再扩展 C1 已有的 `claim.settled` / `flight.landed` payload。

C2 必须遵守设计文档 §10：60fps、CSS `transform` / `opacity`、ChainBeam tx hash 文字 `will-change: transform`，不引入 framer-motion、GSAP 或其他动画框架。C3 的 `HeatmapBg`、`TrailDraw` 不在本 change 内。

## Goals / Non-Goals

**Goals:**

- 在 STORY phase 中让延误触发、链上结算、航班落地三个关键时刻可见。
- `claim.triggered` 映射到 ShockWave，`claim.settled` 映射到 ChainBeam 并保留 KPI tick，`flight.landed` 映射到 FlareLand。
- 只对当前主角或待播主角相关事件播放 C2 动效，避免其他保单事件污染大屏故事。
- 在事件提前到达时允许短暂排队，到 STORY 的时间窗再播放，兼容 C1 `seed-demo` 可能提前结算的现实行为。
- reduced motion 环境下显示短暂静态状态，不播放 scale/translate 动画。
- 后端补发 `claim.triggered`，且不破坏现有 `flare`、`claim.settled`、`flight.landed` 路径。

**Non-Goals:**

- 不实现 `HeatmapBg`、`TrailDraw`。
- 不接真实链、不改变 tx hash 生成规则、不新增结算 payload 字段。
- 不重构 GlobeMap 绘制或替换投影。
- 不新增数据库迁移或持久化 moment 历史。
- 不把 transient 动效状态并入 `CinemaState` 的长期 FSM。

## Decisions

### 1. 动效使用 CSS/SVG transform + opacity，不引入动画框架

`ShockWave` 使用绝对定位 DOM ring；`ChainBeam` 使用 overlay SVG line + pulse + tx hash 文本；`FlareLand` 使用绝对定位 DOM glyph/ping。所有运动只改变 `transform` 和 `opacity`。组件通过 CSS class 或 inline CSS variables 驱动动画，使用 `data-testid` 保持可测。

备选方案是 framer-motion 或 GSAP。放弃原因：项目没有这些依赖，性能预算明确禁止新增动画框架，C2 动效时长短且状态机简单，CSS 足够。

### 2. EventChoreographer 负责事件归一化，TowerShell 持有短生命周期 moment queue

`EventChoreographer` 增加可选 callbacks：

- `onClaimTriggered(moment)`
- `onClaimSettled(moment)`
- `onFlightLanded(moment)`

它继续订阅 `eventStore.events`，沿用 `seenIdsRef` 去重。TowerShell 在 `TowerCinemaLayers` 内维护 `moments` 本地 state，把 callbacks 传给 EventChoreographer，并在 `CinemaOverlay` 内渲染三个组件。

这样做的原因：

- C2 moment 是 2-5 秒短生命周期视觉状态，不适合进入 C1 的长期 `CinemaState`。
- 不需要新增全局 store，也不会影响 Hangar / Claims Feed / KPI 的业务事件状态。
- `EventChoreographer` 仍是唯一事件路由点，符合设计文档的数据流。

备选方案是让 `EventChoreographer` 直接返回 UI。放弃原因：它当前在 TowerShell 中位于 overlay 外，直接渲染会使层级和 pointer-events 语义变得不清晰。

### 3. 事件提前到达时按 STORY 时间窗释放

C1 的 `AutoSeeder` 可能在 cycle establish 阶段调用 `/api/seed-demo`，后端也可能提前广播 settlement 类事件。C2 不强制修改 C1 节奏，而是在前端做 story gate：

- 与当前 protagonist `flightId` 或 `callsign` 不匹配的事件不立即播放；若 60 秒内后续成为主角，可在该主角 STORY 中播放，否则过期丢弃。
- `claim.triggered` 的目标时间窗为 cycle elapsed >= 6s。
- `claim.settled` 的 ChainBeam 至少在同一 policy 的 ShockWave 之后约 2s 开始；若没有对应 trigger，则在 STORY 中收到 settled 后立即播放。
- `flight.landed` 的 FlareLand 至少在 ChainBeam 之后约 2s 或收到 landed 时播放；若没有 ChainBeam，则在压缩 STORY 关键窗口中收到 landed 后立即播放。

实现上用 `keyMomentQueue.ts` 的纯函数计算 pending/active moments，React effect 只负责 timers 与 cleanup。这样 fake timers 可以 deterministically 测时间线。

### 4. 坐标投影复用 `cameraMath.projectLonLat` 与 GlobeMap viewport

C2 overlay 必须和 GlobeMap 当前视口对齐。TowerShell 通过 C1 已有的 `GlobeMap.onViewportChange` 维护当前 `{ k, x, y }`，`CinemaOverlay` 或 moment layer 通过 ResizeObserver 得到 overlay size。纯函数：

- `projectMomentPoint(longitude, latitude, size, viewport)`
- `hangarAnchorForSize(size)`

会将经纬度投影到屏幕坐标。公式复用 `projectLonLat` 后应用 `screenX = projected.x * viewport.k + viewport.x`。

ChainBeam 的 hangar anchor 固定在右上角事件区附近：`x = width - 96`, `y = 72`，避免依赖 EventFeedSidebar 是否展开。该锚点是视觉锚，不需要真实 Hangar DOM。

备选方案是让 GlobeMap 暴露每个 flight dot 的 DOM 坐标。放弃原因：会耦合 SVG 内部结构，且不利于单元测试。

### 5. 机场坐标解析优先级

`claim.triggered` payload 优先使用后端提供的 `longitude` / `latitude` 或 `airport_longitude` / `airport_latitude`。如果没有坐标但有 `airport_iata`，前端使用一个小型静态 `AIRPORT_COORDS` 映射覆盖 demo 常见机场（例如 LHR、JFK、CDG、SFO、SIN、HND、DXB）。如果仍无法解析，则回退当前 protagonist 坐标；仍无坐标时丢弃该视觉 moment 并保留事件记录。

后端发 `claim.triggered` 时查询 `Flight`：`airport_iata` 优先 `destination`，为空则 `origin`，仍为空则 `"UNKNOWN"`。经纬度若无法从 observation 或 `Flight.last_state` 解析，则不强造错误坐标，交给前端 fallback。

### 6. 后端 `claim.triggered` 发射点

`ClaimEngine._process()` 在 `condition.is_triggered(observation)` 返回 true 之后、调用 `adapter.trigger_claim()` 之前广播 `EventType.CLAIM_TRIGGERED`。payload：

- `flight_id`
- `policy_id`
- `delay_minutes`
- `source`
- `airport_iata`
- 可选 `longitude` / `latitude` 或 `airport_longitude` / `airport_latitude`

这代表“风险已触发，正在进入结算”，与后续 `claim.settled` 的链上 mock 结果分离。若 broadcaster 不存在，则行为保持静默，不影响 claim settlement。

### 7. Reduced Motion 与清理策略

组件通过 `useReducedMotion()` 或 CSS `@media (prefers-reduced-motion: reduce)` 判断 reduced motion。Reduced motion 下：

- ShockWave 显示单个静态红圈和标签，约 800ms 后清理。
- ChainBeam 显示静态线和 tx hash，不播放 pulse translate。
- FlareLand 显示静态 FLARE/ping 状态。

普通动效生命周期：

- ShockWave: 2s。
- ChainBeam: 4s。
- FlareLand: 2s。

同屏 active moments 总量限制为 6；超过时丢弃最旧 active moment，避免 WS burst 导致 DOM 堆积。

## Risks / Trade-offs

- C1 `seed-demo` 可能提前触发 settlement → 前端 story gate 排队并在 STORY 窗口释放，避免在 establish 阶段抢戏。
- 后端 Flight 不一定有真实机场经纬度 → payload 提供 `airport_iata`，前端静态机场坐标 + protagonist 坐标 fallback，无法解析时安全丢弃视觉 moment。
- Overlay 与 GlobeMap 尺寸/viewport 不一致 → 用 `onViewportChange` 与 ResizeObserver 双输入，并用纯函数单测投影。
- Event burst 可能造成大量动画 → active cap + TTL cleanup。
- 用户接管 STORY phase → C2 动效随 overlay 保留短生命周期，但不强制恢复 camera，不阻止 manual；若后续测试发现干扰，可在 implementation 时让 interactive mode 暂停释放 pending moments。

## Migration Plan

1. 后端先补 RED 测试，确认 `claim.triggered` 当前缺失；再加 enum 与广播。
2. 前端先补 key moment payload 解析、坐标投影、lifecycle helper 的纯函数 RED/GREEN。
3. 新增三个视觉组件及 reduced motion 测试。
4. 扩展 `EventChoreographer` callbacks，保留 KPI tick 和 REAL 主角队列逻辑。
5. 在 TowerShell 组合 moment queue、viewport、CinemaOverlay 渲染，不破坏点击飞机导航和 manual 接管。
6. 跑后端 pytest、前端 vitest、build、OpenSpec validate。

Rollback 策略：移除 TowerShell 的 C2 callbacks 和 overlay moment children 后，C1 cinema 行为仍保留；后端新增 `claim.triggered` 为 additive，旧前端会忽略该 typed event。

## Open Questions

- `Flight.last_state` 当前未稳定保存经纬度；实现阶段若确认没有可靠来源，将只保证 `airport_iata` 必填，并用前端静态机场坐标/fallback 满足 ShockWave 定位。
- FlareLand 是否使用飞机图标还是文字 `FLARE`：默认使用文字+小型 heading glyph，避免引入图标库或重画飞机资产。
