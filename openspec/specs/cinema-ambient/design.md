## Context

C1 已归档 `cinema-engine`，提供 `CinemaProvider`、30 秒 cycle、REAL/DEMO 主角、CameraDirector、AutoSeeder、EventChoreographer、CinemaOverlay、ModeIndicator、ProtagonistBadge，并让 `useWebSocket` 把 `policy.created`、`claim.triggered`、`claim.settled`、`flight.landed` 写入 typed event ring buffer。C2 已归档 `cinema-key-moments`，在 `CinemaOverlay` 中渲染 ShockWave、ChainBeam、FlareLand，并用 `useKeyMomentQueue` 做 STORY 时间窗释放。

当前实现里前端已经能识别 `policy.created`，`EventChoreographer` 也能把 `source === "real"` 的事件送入 REAL 主角队列；但后端 `EventType` 和 `POST /policies` 路由未看到 `policy.created` 广播。因此 C3 需要补一个最小后端事件，让真实购买既能继续抢占主角，也能给 HeatmapBg 提供数据点。

## Goals / Non-Goals

**Goals:**

- 用 `HeatmapBg` 在地图底层持续显示过去 5 分钟保单坐标密度，形成全球紫红色呼吸热斑。
- 用 `TrailDraw` 在 cycle 第 4-5 秒为当前主角航班绘制一笔画航迹，比 6 秒 ShockWave 提前约 2 秒铺垫。
- 让 C3 与 C1/C2 共存：不影响 manual takeover、点击飞机导航、KPI tick、C2 key moments。
- 所有 C3 动效遵守性能预算：SVG + CSS，避免布局抖动，不使用 canvas，不引入新依赖。
- reduced motion 下给出静态但可见的氛围状态。

**Non-Goals:**

- 不新增后端 heatmap 聚合 endpoint，不做持久化密度表。
- 不调用真实链，不改变 settlement/landed payload。
- 不重构 GlobeMap 投影、地图数据源或 C2 moment queue。
- 不依赖真实 OpenSky track 作为实现前提。

## Decisions

### 1. Heatmap 数据点来源选择前端累积 `policy.created`

采用选项 A：前端从 `eventStore.events` 中读取 `policy.created`，提取可投影坐标并追加到本地 heatmap raw points。理由：

- C3 只需要演示级 5 分钟窗口，不需要可查询历史密度。
- 前端已有 typed WS ring buffer，新增 endpoint 会扩大后端范围和测试矩阵。
- 对真实购买的最小缺口是后端补发 `policy.created`，不是新增密度 API。

`policy.created` payload 至少包含 `flight_id`、`policy_id`、`source`、`created_at`；若可解析，应包含 `longitude`、`latitude`、`callsign`。后端路由可从当前 Flight、flight cache 或 last_state 尝试补坐标；无法补坐标时仍广播事件，前端会安全丢弃该 heatmap point，但 REAL 主角队列仍沿用 C1 的坐标要求。

### 2. Heatmap 5 分钟窗口采用 raw points + 节流重算

`useAmbientHeatmap` 保存 raw points，字段包括 `id`、`longitude`、`latitude`、`createdAt`、`weight`。新 `policy.created` 到达时只做 O(1) 追加与 cap 截断；完整 prune/normalize 每 5 分钟执行一次，也可在测试中通过 fake timers 驱动。

为了让现场真实购买立即可见，新增点会以单点形式进入当前渲染集合；聚合/清理是 5 分钟节流。点数上限建议 120，渲染焦点上限建议 32，超过时保留最新或权重最高点，避免 WS burst 造成 SVG 节点膨胀。

### 3. HeatmapBg 用 SVG radial-gradient 多焦点合成，不用 canvas

`HeatmapBg` 渲染为 `svg[data-testid="heatmap-bg"]`，内部为多个 `radialGradient` + `circle` 或 `ellipse` 焦点。每个焦点坐标使用 C1/C2 已有的 `projectLonLat`/`projectMomentPoint` 同一投影体系，并应用当前 `mapViewport`，保证 zoom/pan 时热斑跟随地图。

呼吸效果只调整 group 的 `opacity` 和可选 `transform: scale(...)`。组件、外层背景 layer、svg 都设置 `pointer-events: none`。Reduced motion 下去掉 breath class，保留静态渐变。

### 4. HeatmapBg 挂在 GlobeMap 下方，不占用 C2 overlay 层

TowerShell 新增底层氛围层：

```text
TowerCinemaLayers
  ├─ <MapAtmosphereLayer> <HeatmapBg/> </MapAtmosphereLayer>  z-index: 0
  ├─ <CameraDirector><GlobeMap/></CameraDirector>             z-index: 1
  ├─ Radar/KPI/EventFeed
  └─ <CinemaOverlay>                                          z-index: 10
       ├─ <TrailDraw/>                                        lower overlay
       ├─ <KeyMomentLayer/>                                   C2 moments
       └─ <ProtagonistBadge/>
```

这样 HeatmapBg 视觉上在地图之下，TrailDraw 与 C2 key moments 在地图之上。若现有 TowerShell 绝对层级需要包一层 `div`，实现只做局部 wrapper，不重写 GlobeMap。

### 5. TrailDraw 由 cycle elapsed/protagonist 触发，而不是 WS 直接触发

闭环压缩后 TrailDraw 在 cycle 第 4 秒出现，并在约第 5 秒清理；此时 C1 phase 名称仍可能是 `establish` 或 `zoom-in`，因此 C3 以 `cycleStartedAt` 与当前墙钟 elapsed 判断触发窗口，而不是等待 `phase === "story"`。触发 key 使用 `${cycleStartedAt}:${protagonist.flightId}` 去重，防止 React 重渲染或 flights 刷新重复播放。

若 protagonist 在第 4-5 秒窗口内才由异步 flights/seed 结果补齐，TrailDraw 仍使用原始 cycle gate，不把窗口整体后移；只有 protagonist 已错过该窗口后才以 protagonist ready 时间作为兜底 gate 起点。

如果用户在 4 秒窗口前接管 manual，新的 TrailDraw 不再释放；已经 active 的短生命周期 trail 可以自然结束，且不改变 camera。页面 hidden 时清理 pending timer，visible 后跟随新 cycle 重新判断。

### 6. 航迹数据用主角当前点 + heading/velocity 推导短路径

现有 `FlightPublic` 只有当前经纬度、速度、航向、on_ground；`CinemaProtagonist` 也只有经纬度/flightId/callsign，没有历史航点。后端有 `/flights/track/{icao24}`，但 protagonist 不携带 icao24，真实 OpenSky track 也不适合作为 C3 的前置依赖。

因此 C3 默认用前端纯函数 `buildTrailPath(protagonist, liveFlight?)`：

- 若能从 live flights 通过 callsign/flightId 匹配到 heading/velocity，则沿 heading 反推 2-3 个历史点，再到当前 protagonist 点。
- 若没有 heading，则以当前点为中心生成一条短的西南到东北 fallback path。
- 若经纬度缺失或不可投影，则不渲染 TrailDraw。

未来若 protagonist 扩展 `origin`/`destination` 或 `icao24`，该函数可以无破坏升级为机场直线或真实 track。

### 7. TrailDraw 使用 SVG path stroke-dash 动画

`TrailDraw` 渲染为 `svg[data-testid="trail-draw"]` 内的 `<path>`。普通模式下使用 `stroke-dasharray` / `stroke-dashoffset` 做 4-5 秒一笔画，并用 `opacity` fade out；这与设计文档附录 A 的 “SVG path stroke-dasharray 动画” 一致。Reduced motion 下 path 直接完整显示，不设置 dash 动画 class。

TrailDraw 层位于 C2 key moments 下方，避免遮住 ShockWave/ChainBeam/FlareLand；`pointer-events: none` 继承自 overlay。

### 8. EventChoreographer 只扩展路由，不持有长期 ambient state

`EventChoreographer` 增加可选 `onPolicyCreated` callback。它继续使用 `seenIdsRef` 对 event id 去重：

- `policy.created` → 先保持 C1 REAL 主角逻辑；同时把事件交给 `onPolicyCreated`，由 TowerShell 或 `useAmbientHeatmap` 决定是否形成 heatmap point。
- `claim.triggered` / `claim.settled` / `flight.landed` → 保持 C2 callbacks。
- unknown events → ignore。

这样 C3 不污染 `CinemaState` 长期 FSM，也不改变 C2 `useKeyMomentQueue`。

### 9. 性能与错误处理

- Heatmap raw points capped，focus nodes capped，5 分钟 prune/normalize，SVG 不使用 canvas/filter-heavy 动效。
- TrailDraw 每个 cycle/protagonist 最多一个 active path，TTL 建议 1 秒，结束后清理 DOM。
- 所有 C3 图层 `pointer-events: none`。
- 坐标不可解析、viewport size 未准备好、WS 断连、页面 hidden 都不得抛运行时错误；C1 degraded/manual 状态优先。
- reduced motion 下禁用 Heatmap breath 和 TrailDraw dash 动画。

## Risks / Trade-offs

- 前端累积 heatmap 刷新后会丢失历史点；这是 demo 氛围可接受的代价，换来更小后端范围。
- 后端 `policy.created` 坐标可能缺失；前端会安全丢弃 heatmap 点，真实主角抢占仍要求坐标，避免跳到无定位航班。
- Heatmap 在 GlobeMap 下方可能受现有 map 背景遮挡；实现时需要检查 GlobeMap SVG 背景透明度，必要时把 heatmap 放在 map wrapper 内的最底 overlay，但仍保持视觉层级低于航班点和 C2。
- TrailDraw 使用推导路径，不是真实航迹；但它只承担氛围表达，不影响保险闭环数据正确性。

## Migration Plan

1. 先补后端 `policy.created` RED 测试，再加 enum 与广播，不改变 `POST /policies` response。
2. 新增 ambient 纯函数与 hook 测试：policy event → heat point、5 分钟 prune、projection、trail path。
3. 新增 `HeatmapBg` / `TrailDraw` 组件与 reduced motion 测试。
4. 扩展 `EventChoreographer` `onPolicyCreated` callback，保留 C1 REAL queue 与 C2 callbacks。
5. 在 `TowerShell` 增加 MapAtmosphereLayer 和 TrailDraw layer，验证点击/手势不被拦截。
6. 跑 focused vitest/pytest、全前端/后端回归、build、OpenSpec validate。

Rollback 策略：移除 TowerShell 中 HeatmapBg/TrailDraw 挂载与 EventChoreographer ambient callback 即可回到 C2；后端新增 `policy.created` 为 additive，旧前端会忽略未知或未消费事件。

## Open Questions

- HeatmapBg 若被现有 GlobeMap 背景遮挡，最终实现可把它放在 GlobeMap 上方但低于 flight dots 的 overlay 层；验收以视觉层级和 pointer-events 为准，不引入地图重写。
- TrailDraw 是否需要后续改接 `/flights/track/{icao24}`：C3 不把真实 track 作为依赖，后续若 protagonist 带 icao24 可增量升级。
