## Context

C1/C2/C3 已完成后，Cinema 大屏具备自动主角、camera zoom、闭环关键时刻、热力图和航迹动效。实际体验反馈要求调整叙事方式：默认不再放大地图，而是在全球视图中直接展示场景动画；当用户真实下单时，当前 DEMO 故事必须立即让位于真实下单点。

当前实现里 `cinemaMachine.ts` 会在 `zoom-in` / `story` / `zoom-out` 阶段生成 `cameraTarget`，`CameraDirector` 把该 target 传给 `GlobeMap` 触发 viewport 插值。C2 `useKeyMomentQueue` 和 C3 `useTrailDraw` 都依赖 phase/cycle/protagonist，但它们的坐标投影已基于 `cameraMath` 和当前 viewport；当 viewport 保持 `{ k: 1, x: 0, y: 0 }` 时仍可在全球视图中渲染。

## Goals / Non-Goals

**Goals:**

- 默认 Cinema 自动播放不再改变 `GlobeMap` viewport；全球视图保持稳定。
- 5 秒后主角从普通飞机点变为视觉高亮，`zoom-in` / `zoom-out` phase 改为高亮 enter/exit 过渡。
- 保留现有 30 秒 cycle 和五段 phase，降低 C2/C3 时间线、AutoSeeder、Radar/KPI 回归风险。
- REAL `policy.created` 在任意 phase 到达时立即抢占当前故事，重置 cycle 并清空 C2/C3 transient moments。
- 1 秒内 REAL burst 只切换第一个事件，其余按 FIFO 进入现有队列，继续保留 cap=3 与 `+N more` 提示。

**Non-Goals:**

- 不删除 `cameraTarget` prop 或 `CameraDirector` 组件。
- 不重写 GlobeMap 投影、不引入地图/动画新依赖。
- 不改变后端 `policy.created` schema，不新增后端接口。
- 不重做 C2/C3 动效；只清理抢占时的旧 moments。

## Decisions

### 1. CameraDirector 改为 spotlight 兼容模式

保留 `CameraDirector` 和 `GlobeMap.cameraTarget` prop，但 cinema 自动播放状态下不再生成非空 `cameraTarget`。`CameraDirector` 仍把 `cameraTarget` 传给 children，默认值为 `null`。这样做有两个好处：第一，不破坏现有组件边界和测试 helper；第二，未来若需要重新启用 zoom，只需恢复 `cameraTargetForPhase` 逻辑而不是重接 TowerShell。

替代方案是删除 `cameraTarget` prop 和 `CameraDirector`。放弃原因：删除会扩大变更面，影响现有 camera tests 和 C2/C3 overlay 投影调试能力。

### 2. phase 时间线保留五段，改变含义而不改变名字

保留 `establish`、`zoom-in`、`story`、`zoom-out`、`rest`。其中 `zoom-in` 表示主角高亮 fade in，`zoom-out` 表示主角高亮 fade out 或回到低强调状态，不再表示 viewport zoom。C2 ShockWave/ChainBeam/FlareLand 和 C3 TrailDraw 继续按 STORY 时间窗运行，AutoSeeder 仍按 cycleId 节流。

替代方案是简化成 `establish/story/rest` 三段。放弃原因：现有测试、C2 timeline、C3 TrailDraw 已依赖 7 秒 STORY 起点和 25 秒 STORY 结束点；三段化会产生较多非业务回归。

### 3. 主角视觉高亮放在 GlobeMap 飞机点层

`TowerShell` 将当前 protagonist 信息传给 `GlobeMap`，`GlobeMap` 在匹配 callsign 或 flightId 的飞机点上添加 `data-protagonist="true"` 与高亮 class，例如 SVG circle 外层 ring/pulse。高亮随现有 projection 和 viewport 自然移动，不需要单独 overlay 重新投影，也不会遮挡点击事件。普通 motion 下 ring/pulse 使用 CSS transform/opacity；reduced motion 可显示静态 ring。

替代方案是在 `CinemaOverlay` 用 SVG `<circle>` 单独画主角环。放弃原因：Overlay 需要重复当前 live position 外推和 hover/drag viewport 对齐，容易和 GlobeMap 点位产生偏移。直接在飞机点层加 ring 性能更稳定、命中目标更明确。

### 4. REAL 立即抢占由 cinema machine 统一处理

`routeRealProtagonistState` 改为在任意 phase 对第一个可用 REAL 事件立即抢占：protagonist 设置为 REAL，`cycleStartedAt = now`，`phase = establish`，`cameraTarget = null`，`cycleId` 递增。为了让 TowerShell 清理 C2/C3 moments，Cinema state 增加单调递增的 `storyResetId` 或等价抢占 token。`useKeyMomentQueue` 暴露 `clearAllMoments()`，TowerShell 在 REAL 抢占 token 变化时清空 active/pending；C3 `useTrailDraw` 也在新 cycle/protagonist key 下重新判断。

替代方案是在 `EventChoreographer` 内直接调用多个 UI reset callback。放弃原因：抢占是 Cinema 级行为，放在 machine 中更容易 TDD 验证，也避免事件路由组件知道 C2/C3 内部状态。

### 5. REAL burst 使用 1 秒窗口避免连续闪切

新增 `lastRealTakeoverAt` 或等价字段。若 REAL 事件到达时距离上一次立即抢占小于 1000ms，则不再切换当前 protagonist，而是进入 FIFO 队列；超过 1000ms 的 REAL 事件可再次立即抢占。队列继续沿用 cap=3，`ProtagonistBadge` 的 `+N more` 语义不变。

这个策略满足“用户主动下单一个就立即展示该点”，同时避免支付或 WS burst 产生多次连续重置。若真实用户连续下多单，第一单成为当前故事，其余按下一轮播放。

### 6. moment queue 清场是 transient UI reset，不改历史事件

REAL 抢占时清空 `useKeyMomentQueue` 的 active/pending moments，只移除当前 overlay DOM 和 timers，不删除 `eventStore.events`。这样 Claims Feed、KPI、Hangar revalidation 仍保留业务事件；只是 Cinema 故事视觉上从 DEMO 清场切换到 REAL。

## Risks / Trade-offs

- 高亮在飞机点层实现可能需要调整现有 SVG 结构 → 用 data-testid 和 regression test 覆盖点击导航、hover、wheel、drag。
- 保留 `zoom-in` / `zoom-out` 名称但改变语义可能让代码阅读产生误解 → 在 design/spec 和测试名中明确 “spotlight transition, no viewport zoom”。
- REAL 抢占会清空刚播放的 C2/C3 动效 → 这是用户确认的优先级；业务事件仍保留在 eventStore。
- 1 秒 burst 窗口需要墙钟测试 → 用 fake timers 覆盖 0ms/999ms/1000ms 边界。

## Migration Plan

1. 更新 cinema-machine RED 测试：cameraTarget 不再生成 zoom，REAL 任意 phase 立即抢占，burst 入队。
2. 更新 GlobeMap/TowerShell RED 测试：5 秒后不再 `scale(5)`，而是主角 dot 高亮。
3. 为 `useKeyMomentQueue.clearAllMoments()` 写 RED 测试，再实现清空 active/pending。
4. TowerShell 接入 REAL 抢占 reset token，清理 key moments 和 active trail。
5. 更新 e2e skip smoke 中的断言文案与真实 smoke 逻辑，从 `scale(5)` 改为 protagonist highlight。
6. 跑前端聚焦回归、全前端、后端 pytest、build、OpenSpec validate。

Rollback：恢复 `cameraTargetForPhase` 输出 zoom target，并把 REAL story phase 行为切回 enqueue；因为保留了 `cameraTarget` prop 和五段 phase，回滚不需要重建组件树。

## Open Questions

无阻塞问题。实现阶段若发现当前 `GlobeMap` 飞机点没有稳定 callsign/flightId 映射，应优先添加小型匹配 helper，而不是改事件 payload 或后端 schema。
