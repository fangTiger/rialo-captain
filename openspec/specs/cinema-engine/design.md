## Context

`/` 当前由 `frontend/src/routes/TowerShell.tsx` 组合 `GlobeMap`、`RadarSweep`、`EventFeedSidebar`、`KPIBand`。`GlobeMap` 使用 SVG + d3-geo 投影和本地 `viewport { k, x, y }` 状态完成缩放/拖拽，点击飞机后导航到 `/flight/:id`。WebSocket 客户端 `useWebSocket` 目前只消费 `flare` 与 `toast`，`eventStore` 只保存 flares/toasts/wsState。后端已有 `/admin/seed-demo`、`/admin/inject-delay`、`ClaimEngine.run_once()` 与 `flare` 广播。

C1 不重做地图、不引入新框架、不实现 C2/C3 动效。CinemaOverlay 只作为挂载点存在；EventChoreographer 在 C1 仅路由 KPI tick 和 REAL 主角抢占信号。

## Goals / Non-Goals

**Goals:**

- `/` 默认进入 cinema 态，30s 一 cycle 自动选主角、显示 spotlight 高亮、触发 demo seed/delay，并循环；默认不改变全球地图 viewport。
- 用户 click/wheel/drag/keydown 后立即进入 manual，显示 30s 倒计时；idle 到期或按 Esc 恢复 cinema。
- `visibilitychange=hidden` 暂停 cinema 与 AutoSeeder，visible 后恢复。
- 真实 `policy.created` / `claim.settled` 事件能够进入主角队列或触发 KPI tick；真实事件优先于 DEMO 主角。
- `/api/seed-demo` 支持 `protagonist_name`，结算事件包含 mock `tx_hash` 与 `block_height`，并发出 `flight.landed`。
- 不破坏当前 `flare` 事件、Claims Feed、Hangar revalidate 等 MVP 行为。

**Non-Goals:**

- 不实现 ShockWave、ChainBeam、FlareLand、HeatmapBg、TrailDraw 的视觉效果。
- 不接真实 Rialo testnet，不引入真实链交易。
- 不持久化 cinema 偏好；刷新后默认 cinema。
- 不重构整个 Tower 或 WebSocket store，只做 C1 必需扩展。

## Decisions

### 1. Cinema 状态机放在前端 Context，而不是 Zustand 全局 store

`CinemaProvider` 管理 `mode`、`phase`、`cycleStartedAt`、`manualRemainingMs`、`protagonist`、`cameraTarget`、`queue`、`degradedReason`。Context 足够覆盖 Tower 子树，避免把大屏临时播放状态混入 `eventStore` 的业务事件状态。

状态：

- `cinema`: 自动播放；内部 phase 为 `establish`、`zoom-in`、`story`、`zoom-out`、`rest`。
- `interactive`: 用户接管；保留当前 viewport，启动 idle 倒计时。
- `paused-hidden`: 页面 hidden；不推进 cycle，不调用 AutoSeeder。
- `degraded`: 数据链路或 seed API 连续失败；ModeIndicator 展示原因，按退避重试恢复。

备选方案是直接用 Zustand。放弃原因：cinema 是局部 UI 编排状态，Context 更容易在测试中用 fake timers 驱动，也减少对现有 store 的迁移。

### 2. CameraDirector 保留 viewport 接口，默认使用 spotlight 高亮

`GlobeMap` 增加可选 props：

- `cameraTarget?: { longitude: number; latitude: number; zoom: number; durationMs: number; reason: string } | null`
- `onUserGesture?: (kind: "click" | "wheel" | "drag" | "keydown") => void`
- `onViewportChange?: (viewport) => void`（仅测试或 overlay 需要时使用）
- `protagonistHighlight?: Protagonist | null`

`CameraDirector` 保留 `cameraTarget` 兼容接口，但 cinema 自动播放默认输出 `cameraTarget = null`，不再驱动 `GlobeMap` zoom/pan。`TowerShell` 将当前 protagonist 作为 `protagonistHighlight` 传给 `GlobeMap`，由飞机点层渲染 `data-protagonist="true"` 与 ring/pulse 高亮。显式传入非空 `cameraTarget` 时，`GlobeMap` 仍可使用既有 `requestAnimationFrame` 插值逻辑，便于未来恢复 zoom 或独立测试旧 camera helper。

这样保留现有投影、tooltip、hover、点击导航逻辑，同时满足用户反馈“默认场景动画不用放大，直接在原图展示即可”。备选方案是删除 `cameraTarget` prop；放弃原因是回滚成本更高，也会扩大 C2/C3 overlay 投影调试的回归面。

### 3. Cycle 时间线使用墙钟，不跟 `TIME_ACCEL` 绑定

Cinema cycle 固定 30s：

- 0-5s `establish`
- 5-7s `zoom-in`（语义改为 spotlight fade in，不改变 viewport）
- 7-25s `story`
- 25-27s `zoom-out`（语义改为 spotlight fade out，不改变 viewport）
- 27-30s `rest`

Controller 使用 `Date.now()` / fake timers 推进 phase；`GlobeMap` 内已有飞机位置外推的 `TIME_ACCEL` 不参与 cinema 时间线。这样设计文档中 “TIME_ACCEL=10 与 30s cycle 解耦” 的约束可测试。

### 4. AutoSeeder 只在 cinema active phase 工作，并带单 cycle 节流

AutoSeeder 监听 `mode === "cinema"` 且页面 visible：

- cycle 进入 `establish` 时选择下一条 DEMO 主角，调用 `/api/seed-demo`，body 包含 `user_email`、`flight_id`（可选）和 `protagonist_name`。
- cycle 到第 12s 且 seed 成功时调用 `/api/inject-delay`，body 包含 seed 返回的 `flight_id` 与固定 demo delay。
- 每个 `cycleId` 最多 seed 一次、inject 一次，失败不会在同 cycle 重试刷屏。
- interactive、paused-hidden、degraded 时清理 timer，不发请求。

浏览器端不得携带 `ADMIN_TOKEN`。实现时新增前端可调用的 demo endpoints（经 Vite 代理为 `/api/seed-demo`、`/api/inject-delay`），受 `CINEMA_AUTOSEED_ENABLED` 或现有 dev/demo 配置限制，且只允许安全的固定 demo 操作；现有 `/admin/*` token 路径继续保留。

### 5. 主角机制采用优先队列，C1 只实现最小可见行为

主角类型：

- `REAL`: 60s 内到达的真实 `policy.created` 或可映射到航班的真实事件。
- `DEMO`: AutoSeeder 从 live flights 中选出的可定位且 `on_ground=false` 的航班，名字池循环。
- `DEMO_OFFLINE`: seed API 失败时的前端 mock 主角，不改变 KPI。

抢占规则：

- REAL `policy.created` 在任意 phase 到达时立即成为当前主角，`cycleStartedAt` 重置为当前墙钟时间，phase 回到 `establish`，`cameraTarget` 保持 `null`。
- REAL 抢占会清空 C2/C3 transient visual moments（ShockWave、ChainBeam、FlareLand、TrailDraw），但不删除 `eventStore.events` 中的业务事件记录。
- 1 秒内连续到达的 REAL burst 只切换第一条；后续事件按 FIFO 入队。
- 队列最多保留 3 条；超出丢弃最旧或最低优先级项，并让 ProtagonistBadge 显示 `+N more`。

C1 不做历史回放，也不为真实事件强行补全所有 C2/C3 动效。

### 6. EventChoreographer 在 C1 只路由 KPI tick 和 REAL 抢占

`useWebSocket` 将已解析消息写入 `eventStore` 的 `events` ring buffer，同时保留 `addFlare` 兼容路径。`EventChoreographer` 订阅 store：

- `claim.settled` 或兼容 `flare` → 调用 cinema action `markKpiTick(payload)`，`KPIBand` 根据 tick id 运行动画。
- `policy.created` 且 `source === "real"` → 触发 REAL protagonist 抢占或按 1 秒 burst 规则入队。
- `flight.landed` → 仅记录事件，不渲染 FlareLand。

ShockWave、ChainBeam、FlareLand 等 C2 组件不出现在 C1 代码中；`CinemaOverlay` 只渲染空容器与 C1 的 ProtagonistBadge。

### 7. 后端事件扩展保持向后兼容

ClaimEngine 结算时继续广播：

- 现有 `flare`：字段保持不变，避免破坏 `useClaims`、Hangar、Claims Feed。
- 新增 `claim.settled`：payload 包含 `flight_id`、`policy_id`、`payout`、`delay_minutes`、`signature`、`settle_duration_ms`、`tx_hash`、`block_height`、`source`。
- 新增 `flight.landed`：payload 包含 `flight_id`、`policy_id`、`landed_at`、`source`。

`tx_hash` 使用 `"0x" + sha256(claim_id 或 policy_id + signature)[:40]`，`block_height` 使用进程内递增整数即可；C1 不要求数据库迁移。若测试需要稳定性，可把 block height 生成器作为 ClaimEngine 依赖注入。

### 8. 错误状态显式可见，不静默失败

- 无可定位 live flights：保持 establish，ModeIndicator 显示 `CINEMA · WAITING FOR AIRCRAFT`，10s 后重试。
- seed-demo 失败：当前 cycle 降级为 `DEMO · OFFLINE`，不改变 KPI；下一 cycle 退避后重试。
- inject-delay 失败：保留镜头和 DEMO 标牌，ModeIndicator 显示 `DEMO LINK DEGRADED`，不重复注入。
- WS `wsState !== "open"`：进入 degraded 展示 `DATA LINK LOST · retry`，重连后恢复 cinema。

## Risks / Trade-offs

- 前端调用 seed/inject 可能扩大 demo 端点暴露面 → 新入口必须受 demo 开关限制，不复用或泄露 `ADMIN_TOKEN`；保留 admin token 路径给脚本。
- `GlobeMap` 当前投影和 viewport 状态在组件内部 → spotlight 高亮应放在飞机点层，避免 overlay 重复投影产生偏移；保留 deterministic helper 测旧 viewport 计算兼容性。
- WebSocket 事件从单一 flare 扩展到 typed events → 通过 ring buffer additive 扩展，保留旧 flare 消费路径。
- AutoSeeder 与 ClaimEngine 都可能触发结算 → 单 cycle 节流和后端 active policy 检查防止重复赔付。
- 页面 hidden/visible 与 idle timer 容易产生悬挂定时器 → 所有 timers 存 ref 并在状态切换、unmount、hidden 时清理。

## Migration Plan

1. 先新增测试覆盖 cinema reducer/timer、AutoSeeder 节流、backend payload；确认 RED。
2. 以 additive 方式增加前端 cinema 目录和 eventStore 字段，不删除旧 flares。
3. 扩展后端 seed/inject 兼容入口和 ClaimEngine 广播；旧 admin endpoint 和 flare 测试继续通过。
4. 将 TowerShell 接入 Provider，再逐步把 GlobeMap/KPI/Radar 的新 props 接上。
5. 验证后端 pytest、前端 vitest，并在实现阶段用 Playwright smoke 验证 `/` 主角高亮、全球 viewport 保持稳定与 manual 倒计时。

Rollback 策略：移除 TowerShell 的 CinemaProvider 包装即可让 `/` 回到当前手动大屏；后端新增事件为 additive，旧客户端仍只消费 `flare`。

## Open Questions

- 前端安全 demo endpoint 的开关名称建议为 `CINEMA_AUTOSEED_ENABLED`，实现阶段需确认是否复用现有 dev/demo 配置。
- `policy.created` 真实事件在当前 MVP 尚未广播；C1 是否需要补发最小事件用于 REAL 抢占，还是仅为后续真实购买流程预留解析能力。默认实现最小可测广播，不改变购买接口响应。
