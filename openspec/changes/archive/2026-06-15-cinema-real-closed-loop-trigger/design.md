## Context

当前 Cinema 已具备三段能力：

- C1：REAL `policy.created` 可以立即抢占主角，重置 cycle，并清空 transient visual moments。
- C2：`claim.triggered`、`claim.settled`、`flight.landed` 可以在 STORY 时间窗释放 ShockWave、ChainBeam、FlareLand。
- C3：TrailDraw 与 HeatmapBg 已接入 STORY 和 `policy.created`。

缺口在真实下单后的后端触发：REAL 主角成为 protagonist 后，`AutoSeeder` 会跳过 DEMO `seed-demo`，但也不会调用 `/api/inject-delay`。因此真实保单不会自动进入 ClaimEngine 的检测/结算链路，用户看到的是“切到真实点”，而不是设计文档第 112 行描述的“真实下单后几秒内 tx hash 飘过”。

本 change 只补前端触发闭环；后端 `/api/inject-delay` 已存在且不需要 token，不新增字段或接口。

## Goals / Non-Goals

**Goals:**

- REAL 主角成为当前 protagonist 后，自动且幂等地调用一次 `POST /api/inject-delay`。
- DEMO 剧本保持现状：`seed-demo` 后第 12 秒注入延误。
- REAL 剧本跳过 `seed-demo`，直接触发 inject-delay，让后端 ClaimEngine 广播完整闭环事件。
- REAL burst 中每个实际成为当前 protagonist 的 REAL 都触发自己的 inject-delay；1 秒内排队的 REAL 在后续 cycle 成为主角时触发。
- inject-delay 失败时给出 `REAL · INJECT FAILED` 短暂可见提示，不阻塞用户接管。

**Non-Goals:**

- 不修改后端 `/api/inject-delay`、`/policies` 或 WebSocket payload schema。
- 不改变 REAL 任意 phase 立即抢占规则。
- 不绕过 C2 STORY gate；ShockWave/ChainBeam/FlareLand 仍按现有 key moment timeline 播放。
- 不重做 C2/C3 视觉组件，不引入新依赖。
- 不动 `rialo-captain-mvp`。

## Decisions

### 1. REAL 抢占后立即调用 inject-delay

采用选项 A：REAL 主角一旦进入 `CinemaState.protagonist`，前端立即调用 `/api/inject-delay`。

理由：

- 后端 ClaimEngine 需要时间完成延误注入、检测、`claim.triggered`、`claim.settled`、`flight.landed` 广播；越早触发，越能保证 STORY phase 到达 15 秒窗口前事件已在前端 pending queue。
- C2 视觉释放仍受 STORY 15s gate 控制，所以“立即触发后端链路”不会导致 ShockWave 提前破坏时间线。
- 与设计文档第 112 行“5s 内大屏切到这条真实保单做主角 → tx hash 飘过”的演示诉求更匹配。

放弃选项 B（5s 后）和 C（12s 后）：它们与 DEMO 节奏更一致，但会把真实下单后的闭环反馈推迟，增加评委现场等待时间，也更容易错过当前 STORY 窗口。

### 2. 在 AutoSeeder 中分离 DEMO 与 REAL 注入路径

保持 `AutoSeeder` 作为后台闭环编排模块，但内部拆成两条路径：

- DEMO path：现有逻辑不变，establish 阶段选择 DEMO、写回 CinemaState、调用 `/seed-demo`，第 12 秒调用 `/inject-delay`。
- REAL path：当 `mode === "cinema"` 且当前 protagonist 为 REAL 时，不调用 `/seed-demo`，立即调用 `/inject-delay`。

如果实现阶段发现 `AutoSeeder` 过于拥挤，可以提取 `useRealClosedLoopTrigger` hook，但仍由 `TowerShell` 与 `CinemaProvider` 组合，不引入全局 store。

### 3. REAL inject 幂等 key 使用 cycleId / flight_id / policy_id

前端从 `policy.created` payload 提取 `policy_id`，作为内部 `RealProtagonistEvent.policyId` 和 `CinemaProtagonist.policyId` 的可选字段保留。dedup key 为：

```text
real:<cycleId>:<flightId>:<policyId>
```

如果 legacy 或测试事件缺少 `policy_id`，使用 event id 作为 fallback；不改变后端 schema。

该 key 存入 `useRef<Set<string>>`，避免 React rerender、effect 依赖变化、HMR 或重复 WebSocket 消费导致多次 inject。DEMO 的 `injectedByCycleRef` 保持独立，不与 REAL dedup 集合混用。

### 4. REAL burst 与 queued REAL 的触发点

REAL burst 规则仍由 cinema state machine 决定：

- 第一条 REAL 立即成为 protagonist，并立即触发自己的 inject-delay。
- 1 秒内后续 REAL 入队，不立即 inject。
- 当 queued REAL 在后续 cycle 被提升为当前 protagonist 时，REAL path 观察到新的 `cycleId + flightId + policyId` key，触发该 REAL 自己的 inject-delay。

这样避免“还没成为大屏主角的真实保单提前播放闭环”，同时满足每个真实主角都有独立闭环的要求。

### 5. inject 失败使用短暂 UI 提示，不进入阻塞 degraded

REAL inject 失败属于演示链路失败，不应阻塞 manual takeover 或把系统永久降级。新增一个短暂状态或消息字段，例如：

```ts
realInjectErrorUntil: number | null
```

`ModeIndicator` 在当前 protagonist 为 REAL 且该时间窗未过期时显示 `REAL · INJECT FAILED`。该提示优先级低于 manual 和 data-link-lost，高于普通 `CINEMA`。提示 TTL 建议 3 秒。

失败不重复刷同一 dedup key；用户再次真实下单或 queued REAL 成为主角会产生新 key，可重新触发。

### 6. 端到端事件链路保持现有 C2/C3 路由

REAL inject 成功后，期望后端走现有链路：

```text
/api/inject-delay
  -> ClaimEngine 检测真实 policy
  -> claim.triggered
  -> claim.settled
  -> flight.landed
  -> EventChoreographer
  -> useKeyMomentQueue
  -> ShockWave / ChainBeam / FlareLand
```

前端不直接伪造 `claim.triggered` 或 `claim.settled`。KPI tick、tx hash 文本、FlareLand 等继续由 C2/C1 事件处理。

## Risks / Trade-offs

- REAL `policy.created` payload 若缺少 `policy_id` → dedup fallback 使用 event id；self-review 需确认现有后端广播包含 `policy_id`。
- `/api/inject-delay` 如果按 flight_id 只找到 DEMO policy 而非真实 policy → 这是后端现有行为风险；本 change 不改后端，但验证阶段需要用真实下单 smoke 或 backend test 确认可触发真实 policy claim。
- 立即 inject 可能在用户马上手动接管后仍已发出请求 → 接受；真实下单闭环是用户主动行为，且请求幂等，不应因 manual takeover 撤销业务事件。
- 失败提示如果放入 `mode="degraded"` 会干扰 WS data-link-lost 与 manual 恢复 → 不使用长期 degraded；用短暂字段或 toast-like cinema notice。
- REAL path 与 DEMO path 共用 AutoSeeder 可能让组件职责变重 → 如测试发现 effect 复杂度过高，提取 hook，但行为仍归属 cinema-engine。

## Migration Plan

1. 先补 RED 测试：REAL protagonist 进入 state 后立即调用 `/inject-delay`，且不调用 `/seed-demo`。
2. 补幂等 RED 测试：同一 REAL rerender 不重复 inject，dedup key 包含 cycleId/flightId/policyId。
3. 补 burst RED 测试：第一条 REAL 立即 inject，queued REAL 成为新 cycle protagonist 时再 inject。
4. 补失败 RED 测试：inject-delay reject 后 ModeIndicator 显示 `REAL · INJECT FAILED`，manual takeover 仍可用。
5. 实现最小代码到 GREEN，跑全前端、全后端、build、OpenSpec validate。

Rollback：移除 REAL path effect 与失败提示状态即可恢复当前行为；DEMO path 与后端 API 不需要迁移。

## Open Questions

无阻塞问题。默认采用“REAL 抢占后立即 inject-delay”。
