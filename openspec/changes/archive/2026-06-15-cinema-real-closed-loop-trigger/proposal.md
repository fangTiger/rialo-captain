## Why

用户确认要“自动触发完整闭环”。当前 REAL `policy.created` 已能立即抢占主角，但不会自动触发 `/api/inject-delay`，导致真实下单后大屏只切主角，不会在几秒内进入 `claim.triggered` → `claim.settled` → `flight.landed` 的闭环演示。

设计文档第 112 行的杀手锏 demo 场景是：“评委盯虚拟剧情看 → 你当场在 Hangar 买一张 → 5s 内大屏切到这条真实保单做主角 → 链上 tx hash 真的飘过 → 评委被劫持。” 本 change 让 REAL 抢占自动触发后端延误注入，从而补齐真实下单后的闭环动效链路。

## What Changes

- REAL protagonist 成为当前主角时，前端自动调用一次 `POST /api/inject-delay`，body 至少包含 `flight_id` 与 demo 延误分钟数。
- DEMO protagonist 继续保持现有节奏：`seed-demo` 后第 12 秒调用 `inject-delay`。
- REAL protagonist 跳过 `seed-demo`，因为真实保单已由用户下单创建。
- REAL inject 使用 `cycleId`、`flight_id`、可选 `policy_id` 或事件 id 组成 dedup key，避免 React 重渲染、重复 WS 消费或 HMR 导致重复注入。
- 1 秒 REAL burst 中，只有真正成为当前主角的 REAL 立即触发 inject；排队 REAL 在后续 cycle 成为当前主角时各自触发一次。
- REAL inject 失败时，ModeIndicator 显示短暂 `REAL · INJECT FAILED`，不阻塞用户接管，也不改变后端 API schema。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `cinema-engine`: 新增 Requirement “REAL 抢占触发完整闭环”，定义 REAL 主角自动 inject-delay、幂等、burst 队列和失败提示行为。

## Impact

- Affected frontend:
  - `frontend/src/components/cinema/AutoSeeder.tsx` 或等价后台编排 hook。
  - `frontend/src/components/cinema/CinemaContext.tsx` / `cinemaMachine.ts`，如需记录 REAL inject 失败的短暂 UI 状态或 dedup 元数据。
  - `frontend/src/components/cinema/ModeIndicator.tsx`，显示 `REAL · INJECT FAILED`。
  - 相关测试：`auto-seeder.test.tsx`、`event-choreographer.test.tsx`、`cinema-controller.test.tsx`、`cinema-key-moments-*` 集成测试。
- Affected backend:
  - 不新增或修改后端 API；复用现有 `/api/inject-delay`。
- Dependencies:
  - 不引入新依赖。
- Out of scope:
  - 不改变 REAL 任意 phase 立即抢占规则。
  - 不改 `/policies`、`/api/inject-delay` payload schema。
  - 不动 `rialo-captain-mvp`。
