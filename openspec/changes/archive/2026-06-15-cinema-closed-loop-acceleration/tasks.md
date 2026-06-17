## 1. 后端 ClaimEngine 航班级扫描

- [x] 1.1 RED：在 `backend/tests/unit/test_claim_engine.py` 增加 `run_for_flight()` 测试，创建两个 ACTIVE flight 的 policy，注入目标航班延误后只触发目标航班；验证命令：`.venv/bin/pytest backend/tests/unit/test_claim_engine.py -q`。
- [x] 1.2 GREEN：修改 `backend/claims/engine.py`，新增 `run_for_flight(flight_id: str)`，查询目标航班 ACTIVE policy 并复用 `_process()`；验证命令同 1.1。
- [x] 1.3 RED：在 `backend/tests/unit/test_claim_engine.py` 增加日志测试或 `caplog` 断言，`run_for_flight()` 输出 `checking flight=X policies=N`；验证命令同 1.1。
- [x] 1.4 GREEN：给 `run_for_flight()` 增加 INFO `checking` 日志，保持 `run_once()` 现有行为；验证命令同 1.3。
- [x] 1.5 RED：增加 `triggered`、`settled`、`landed` INFO 日志断言，覆盖 policy id、delay、tx、flight id；验证命令同 1.1。
- [x] 1.6 GREEN：在 `_process()` 的条件命中、settlement payload 生成、landed 广播前输出 INFO 日志；验证命令同 1.5。

## 2. inject-delay endpoint 立即触发闭环

- [x] 2.1 RED：在 `backend/tests/integration/test_reactive_e2e.py` 增加 `/inject-delay` 测试，真实 policy 创建后调用 public endpoint，不再手动 `engine.run_once()`，立即能在 `/claims/recent` 看到 claim；验证命令：`.venv/bin/pytest backend/tests/integration/test_reactive_e2e.py -q`。
- [x] 2.2 GREEN：修改 `backend/admin/routes.py`，让 public `/inject-delay` 写入 `_DELAY_OVERRIDES` 后调用 `request.app.state.claim_engine.run_for_flight(flight_id)`；验证命令同 2.1。
- [x] 2.3 RED：在 `backend/tests/integration/test_admin_routes.py` 或 `test_reactive_e2e.py` 增加 `/admin/inject-delay` 同步触发测试，确认 admin endpoint 也不需要额外 `run_once()`；验证命令：`.venv/bin/pytest backend/tests/integration/test_admin_routes.py backend/tests/integration/test_reactive_e2e.py -q`。
- [x] 2.4 GREEN：把 `_inject_delay_impl()` 改为两个 endpoint 共享即时检测路径，不改变 `InjectDelayResponse` schema；验证命令同 2.3。
- [x] 2.5 RED：补充 endpoint 404/disabled 测试，未知 flight 或 demo disabled 时不得调用 `run_for_flight()`；验证命令：`.venv/bin/pytest backend/tests/integration/test_admin_routes.py -q`。
- [x] 2.6 GREEN：确保 `_inject_delay_impl()` 只在 flight 存在且 endpoint 允许时写 delay 和运行 engine；验证命令同 2.5。

## 3. AutoSeeder DEMO inject 提前到 3 秒

- [x] 3.1 RED：在 `frontend/src/tests/auto-seeder.test.tsx` 更新 DEMO timing 测试，cycle 2999ms 不调用 `/inject-delay`，3000ms 调用一次；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 3.2 GREEN：修改 `frontend/src/components/cinema/AutoSeeder.tsx` 的 DEMO inject gate，从 12_000ms 改为 3_000ms，保留单 cycle 节流；验证命令同 3.1。
- [x] 3.3 RED：补充 manual / paused-hidden / degraded 在 3000ms 不 inject 的回归测试；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx cinema-controller.test.tsx`。
- [x] 3.4 GREEN：确认现有 mode gating 覆盖 3 秒路径，必要时清理 timer ref；验证命令同 3.3。

## 4. C2 key moments 时间线压缩

- [x] 4.1 RED：在 `frontend/src/tests/key-moment-timeline.test.ts` 或 `cinema-key-moments-timeline.test.tsx` 更新 ShockWave gate：4999ms 不释放，5000ms 释放；验证命令：`cd frontend && pnpm test -- key-moment-timeline.test.ts cinema-key-moments-timeline.test.tsx`。
- [x] 4.2 GREEN：修改 `frontend/src/components/cinema/keyMomentTimeline.ts`，把 `STORY_TRIGGER_AT_MS` 改为 5_000；验证命令同 4.1。
- [x] 4.3 RED：更新 ChainBeam / FlareLand 精确时序测试，ChainBeam 在 ShockWave 后 1000ms，FlareLand 在 ChainBeam 后 2000ms；验证命令同 4.1。
- [x] 4.4 GREEN：把 `FLARE_AFTER_CHAIN_MS` 改为 2_000，保留 `CHAIN_AFTER_SHOCKWAVE_MS = 1_000`；验证命令同 4.3。
- [x] 4.5 RED：更新 `frontend/src/tests/cinema-key-moments-integration.test.tsx`，REAL 下单闭环在 5s/6s/8s 渲染 ShockWave/ChainBeam/FlareLand；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx`。
- [x] 4.6 GREEN：修正集成测试依赖的 fake timer 推进与 timeline 常量；验证命令同 4.5。

## 5. C3 TrailDraw 提前到 3 秒

- [x] 5.1 RED：在 `frontend/src/tests/use-trail-draw.test.tsx` 更新 TrailDraw gate，2999ms 不触发，3000ms 创建 active item；验证命令：`cd frontend && pnpm test -- use-trail-draw.test.tsx`。
- [x] 5.2 GREEN：修改 `frontend/src/components/cinema/useTrailDraw.ts`，把 start gate 从 7_000ms 改为 3_000ms；验证命令同 5.1。
- [x] 5.3 RED：更新 TrailDraw 生命周期测试，3s 开始、约 6s 清理；验证命令：`cd frontend && pnpm test -- use-trail-draw.test.tsx cinema-ambient-integration.test.tsx`。
- [x] 5.4 GREEN：调整 TrailDraw lifecycle timer 与集成测试 fake timer，保持 pointer-events 和层级不变；验证命令同 5.3。

## 6. 全量回归、自审与提交流程

- [x] 6.1 聚焦回归：运行 `.venv/bin/pytest backend/tests/unit/test_claim_engine.py backend/tests/integration/test_admin_routes.py backend/tests/integration/test_reactive_e2e.py -q`，修复失败。
- [x] 6.2 全后端回归：运行 `.venv/bin/pytest backend/tests -q`。
- [x] 6.3 聚焦前端回归：运行 `cd frontend && pnpm test -- auto-seeder.test.tsx key-moment-timeline.test.ts cinema-key-moments-timeline.test.tsx cinema-key-moments-integration.test.tsx use-trail-draw.test.tsx cinema-ambient-integration.test.tsx`。
- [x] 6.4 全前端回归：运行 `cd frontend && pnpm test`。
- [x] 6.5 类型与构建：运行 `cd frontend && pnpm exec tsc --noEmit && pnpm build`。
- [x] 6.6 OpenSpec 验证：运行 `openspec validate cinema-closed-loop-acceleration --strict --no-interactive`。
- [x] 6.7 graphify 同步：运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 6.8 最终 self-review：对照用户两条原话、P0 5W 根因、P1 5s/3s/2s 时间线、三个 spec delta、日志可观测性和“不动 rialo-captain-mvp”逐条列“已覆盖 / 部分覆盖 / 未覆盖”，修复后重跑相关测试。
