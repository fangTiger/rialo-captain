## Context

当前 Cinema 大屏在两个实际体验点上偏离预期：

- DEMO 主角由 `chooseDemoProtagonist(flights)` 取第一架可定位且未落地航班；mock flights 顺序 deterministic，刷新后红色 protagonist 高亮容易固定在同一架飞机。
- 后端 `policy.created.created_at` 来自 `Policy.created_at`，单位是 Unix 秒；前端 `EventChoreographer` 将该值直接传入 `cinemaMachine`，而 `routeRealProtagonistState` 用毫秒墙钟做 60 秒 lookback，导致真实下单事件被判旧事件。

约束：

- 不改变后端 `/policies` 响应或 WebSocket payload schema。
- 不持久化 cinema preference 或 protagonist；刷新后仍是默认 cinema。
- 不动 `rialo-captain-mvp`，不处理未归档的 `cinema-key-moments-followup-shockwave-protagonist-fallback`。
- dev.sh 后台仍在跑，不能 kill。

## Goals / Non-Goals

**Goals:**

- DEMO 主角在候选航班之间轮转，不能固定第一架。
- 页面刷新时使用 session-only seed，让首次 DEMO 主角不总是相同；seed 只在当前 React 页面生命周期内存在，不写浏览器持久化存储。
- AutoSeeder 选择的 DEMO 主角写回 `CinemaState`，让视觉高亮、ProtagonistBadge、seed-demo body 对齐。
- REAL `policy.created` 同时接受后端秒级 timestamp 与前端测试/客户端毫秒级 timestamp。
- 保持 REAL 抢占、1 秒 burst、C2/C3 transient 清场现有行为。

**Non-Goals:**

- 不新增后端字段，不把 `created_at` 后端改成毫秒。
- 不改变 C2 ShockWave / ChainBeam / FlareLand 或 C3 HeatmapBg / TrailDraw 的渲染规则。
- 不为真实航班补坐标 fallback；若 `policy.created` 缺经纬度，仍按现有规则不抢占。
- 不归档其他 active change。

## Decisions

### 1. `chooseDemoProtagonist` 改为候选列表轮转

`chooseDemoProtagonist(flights, index)` 先过滤出满足 `on_ground=false`、经纬度可用、ETA 可用的候选，再取 `candidates[index % candidates.length]`。候选为空时返回 `null`。`name` 仍使用 `demoNameAt(index)`，因此候选与名字都能随 cycle 前进。

替代方案是打乱 `flights` 数组。放弃原因：会破坏调用方对 live flights 顺序的预期，也让测试不稳定。

### 2. session-only seed 放在 `TowerShell` 页面挂载层

`TowerShell` 用 `useRef` 在组件首次挂载时生成 `demoSeed`，例如 `Math.floor(Math.random() * 10_000)`。该值不写入 localStorage/sessionStorage/cookie。初始 `CinemaProvider.initialProtagonist` 使用 `chooseDemoProtagonist(flights, demoSeed)`，后续 DEMO cycle 使用 `demoSeed + cycleId - 1`。

这样刷新浏览器会重新生成 seed，但同一次页面生命周期内每个 cycle 可预测，方便测试通过注入或 mock `Math.random` 控制。

### 3. AutoSeeder 负责把 DEMO 选择写回 CinemaState

新增 `setDemoProtagonist(protagonist)` action：

- `cinemaMachine` 提供 `setDemoProtagonistState(state, protagonist)`。
- `CinemaContext` 暴露 `setDemoProtagonist`。
- `AutoSeeder` 在 establish 且当前没有 REAL 主角时，按 `demoSeed + cycleId - 1` 选择 DEMO protagonist，先调用 `setDemoProtagonist`，再调用 `/seed-demo`。
- 如果当前 protagonist 是 REAL 或 realQueue 非空，AutoSeeder 不覆盖 REAL 叙事。

这样当前视觉 protagonist 与 seed-demo 使用的 protagonist 一致。seed API 失败时，现有 `markDemoOffline(protagonist)` 仍能把同一个 DEMO 主角标记为 `DEMO_OFFLINE`。

替代方案是在 `CinemaController` 内每个 cycle 自动选 DEMO。放弃原因：Controller 当前不接收 flights；把 live flights 依赖塞进 Controller 会扩大组件职责。

### 4. timestamp 归一化 helper 放在 EventChoreographer

在 `EventChoreographer.tsx` 增加并导出 `normalizeCreatedAtMs(value, fallback)`：

- 非 number 或非 finite 时返回 `fallback`。
- `< 10_000_000_000` 视为 Unix 秒，返回 `value * 1000`。
- 其他数值视为毫秒。

`realPolicyCreatedFromEvent` 使用该 helper 生成 `createdAt`。`ambientHeatmap.ts` 已有等价 `timestampMs`，本次不强行抽共享 util，避免为小修复重构模块边界；但任务中需要检查其他 `created_at` 使用点是否已归一化。

### 5. 测试策略保持 RED-GREEN

先写会失败的测试：

- `chooseDemoProtagonist` 用 3 个候选验证 index 0/1/2/3 轮转，且落地/无坐标/ETA 不合适候选被跳过。
- `AutoSeeder` 在新 cycle 选择下一个 DEMO 并写回 Badge/GlobeMap protagonist。
- `EventChoreographer` 使用 `Math.floor(Date.now() / 1000)` 的 `policy.created.created_at`，断言立即显示 `REAL · LIVE`。

再实现最小代码到 GREEN，最后跑全前端、后端和 build。

## Risks / Trade-offs

- 随机 seed 会让视觉首屏不完全 deterministic → 测试通过 mock `Math.random` 或把 seed prop 注入测试 wrapper 控制。
- AutoSeeder 写回 state 可能覆盖 REAL → 明确只在无 REAL current/queue 时写 DEMO，并添加 regression test。
- `CinemaProvider` 当前以 protagonist flightId 作为 key，live flights 更新可能触发 remount → 实现阶段需要检查是否保留 key，必要时改为稳定 key，防止 cycle state 被 live polling 意外重置。
- 坐标缺失的真实下单仍不会抢占 → 本次不改 payload 或 fallback，避免扩大范围；后续如实测仍遇到坐标缺失，再走单独 change。

## Migration Plan

1. 写 RED 测试覆盖 DEMO 候选轮转、AutoSeeder 写回 state、秒级 `policy.created` 抢占。
2. 实现 `chooseDemoProtagonist` 候选轮转。
3. 增加 `setDemoProtagonist` state/action，并在 AutoSeeder establish 中写回。
4. 接入 TowerShell session-only seed，确保初始 protagonist 与 AutoSeeder 使用同一 seed。
5. 在 EventChoreographer 归一化 `created_at`。
6. 跑聚焦 vitest、全前端 vitest、后端 pytest、`pnpm build`、`pnpm exec tsc --noEmit`、OpenSpec validate。

Rollback：恢复 `chooseDemoProtagonist` 第一候选逻辑、移除 `setDemoProtagonist` action，并让 EventChoreographer 直接传 payload `created_at`；不涉及后端迁移。

## Open Questions

无阻塞问题。实现阶段若发现 `CinemaProvider key={protagonist?.flightId}` 导致 live flights polling 频繁 remount，应在本 change 内修为稳定 key，因为它会直接影响 DEMO 轮转与 REAL 抢占状态保持。
