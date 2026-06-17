## 1. REAL 主角身份元数据

- [x] 1.1 RED：在 `frontend/src/tests/event-choreographer.test.tsx` 增加测试，REAL `policy.created` payload 的 `policy_id` 应进入 Cinema protagonist 内部状态；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 1.2 GREEN：修改 `frontend/src/components/cinema/EventChoreographer.tsx`、`protagonist.ts`、`cinemaMachine.ts`，为 `RealProtagonistEvent` / `CinemaProtagonist` 增加可选 `policyId` 并从 payload 提取；验证命令同 1.1。
- [x] 1.3 RED：在 `frontend/src/tests/protagonist-queue.test.ts` 增加 queued REAL 被下一 cycle 提升时仍保留 `policyId` 的测试；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`。
- [x] 1.4 GREEN：修正 `advanceCinemaState()` / `toRealProtagonist()` 的 queue promotion 路径，保留 `policyId`、`flightId`、`callsign`；验证命令同 1.3。

## 2. REAL inject-delay 触发与幂等

- [x] 2.1 RED：在 `frontend/src/tests/auto-seeder.test.tsx` 增加 REAL 当前主角测试，AutoSeeder 在 establish 后立即调用 `/inject-delay` 且不调用 `/seed-demo`；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 2.2 GREEN：修改 `frontend/src/components/cinema/AutoSeeder.tsx`，增加 REAL path：`mode === "cinema"` 且 protagonist.kind 为 REAL 时按当前 protagonist 立即 POST `/inject-delay`；验证命令同 2.1。
- [x] 2.3 RED：补充同一 REAL protagonist React rerender / effect rerun 不重复调用 `/inject-delay` 的 regression test，断言 dedup key 包含 `cycleId`、`flight_id`、`policy_id`；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 2.4 GREEN：在 AutoSeeder 内新增 REAL inject dedup ref，与 DEMO `injectedByCycleRef` 分离；缺少 `policyId` 时 fallback 到 event id 或 stable flight key；验证命令同 2.3。
- [x] 2.5 RED：补充 REAL burst 测试：第一条 REAL 立即 inject，1 秒内 queued REAL 不 inject；推进到下一 cycle queued REAL 成为 protagonist 后再 inject 一次；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx protagonist-queue.test.ts`。
- [x] 2.6 GREEN：确保 AutoSeeder 只对当前 protagonist 触发 REAL inject，queue 中事件不提前触发；验证命令同 2.5。
- [x] 2.7 RED：补充 interactive / paused-hidden 状态下 REAL inject 不发请求，恢复 cinema 且 REAL 仍为当前 protagonist 时才发请求；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx cinema-controller.test.tsx`。
- [x] 2.8 GREEN：复用现有 mode gating，确保 REAL path 不绕过页面 hidden/manual 约束；验证命令同 2.7。

## 3. REAL inject 失败提示

- [x] 3.1 RED：在 `frontend/src/tests/cinema-ui.test.tsx` 或 `auto-seeder.test.tsx` 增加 inject-delay reject 测试，ModeIndicator 显示 `REAL · INJECT FAILED`；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx auto-seeder.test.tsx`。
- [x] 3.2 GREEN：在 `frontend/src/components/cinema/cinemaMachine.ts` / `CinemaContext.tsx` 增加短暂 REAL inject failure 状态与 action，例如 `markRealInjectFailed`；`AutoSeeder` catch 时调用；验证命令同 3.1。
- [x] 3.3 RED：补充失败提示 TTL 测试，3 秒后自动回到普通 CINEMA/REAL 显示；manual 和 data-link-lost 优先级高于失败提示；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx cinema-controller.test.tsx`。
- [x] 3.4 GREEN：修改 `frontend/src/components/cinema/ModeIndicator.tsx` 与 controller tick 清理逻辑，实现短暂提示和优先级；验证命令同 3.3。
- [x] 3.5 RED：补充失败后同一 dedup key 不重复刷请求的测试；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 3.6 GREEN：失败时保留 dedup key，不在同一 REAL protagonist 下自动重试；验证命令同 3.5。

## 4. 完整闭环集成

- [x] 4.1 RED：在 `frontend/src/tests/cinema-key-moments-integration.test.tsx` 增加 REAL 下单集成测试：mock WS 推 `policy.created` 后 AutoSeeder 调 `/inject-delay`，随后推 `claim.triggered` / `claim.settled` / `flight.landed`，断言 ShockWave / ChainBeam / FlareLand 按现有 timeline 渲染；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx auto-seeder.test.tsx`。
- [x] 4.2 GREEN：修正 TowerShell / AutoSeeder / EventChoreographer 接线中的缺口，确保 REAL inject 成功后仍沿用现有 eventStore 和 KeyMomentQueue；验证命令同 4.1。
- [x] 4.3 RED：补充不伪造 C2 事件的 negative test，AutoSeeder 只调用 `/inject-delay`，不会直接 enqueue ShockWave / ChainBeam / FlareLand；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx event-choreographer.test.tsx`。
- [x] 4.4 GREEN：保持 C2 事件来源只来自 WebSocket / eventStore，修复若有失败；验证命令同 4.3。
- [x] 4.5 检查后端 `/api/inject-delay` 现有测试是否覆盖真实 policy；若缺少真实保单触发路径测试，先加 RED 后补最小后端测试，不改 API schema；验证命令：`.venv/bin/pytest backend/tests -q`。

## 5. 回归、验证与自审

- [x] 5.1 聚焦前端回归：运行 `cd frontend && pnpm test -- auto-seeder.test.tsx event-choreographer.test.tsx protagonist-queue.test.ts cinema-ui.test.tsx cinema-controller.test.tsx cinema-key-moments-integration.test.tsx`，修复失败。
- [x] 5.2 全前端回归：运行 `cd frontend && pnpm test`。
- [x] 5.3 全后端回归：运行 `.venv/bin/pytest backend/tests -q`。
- [x] 5.4 类型与构建：运行 `cd frontend && pnpm exec tsc --noEmit && pnpm build`。
- [x] 5.5 OpenSpec 验证：运行 `openspec validate cinema-real-closed-loop-trigger --strict --no-interactive`。
- [x] 5.6 graphify 同步：运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 5.7 最终 self-review：对照设计文档第 112 行、spec 每个 scenario、REAL burst、失败提示、C1/C2/C3 共存与“不改后端 API schema”逐条列出“已覆盖 / 部分覆盖 / 未覆盖”，修复后重跑相关测试。
