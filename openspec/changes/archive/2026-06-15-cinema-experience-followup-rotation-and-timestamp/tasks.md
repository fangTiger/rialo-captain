## 1. DEMO 主角候选轮转

- [x] 1.1 RED：在 `frontend/src/tests/protagonist-queue.test.ts` 增加 `chooseDemoProtagonist` 候选轮转测试，3 个可用候选 index 0/1/2/3 应选择 A/B/C/A；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`。
- [x] 1.2 GREEN：修改 `frontend/src/components/cinema/protagonist.ts`，先过滤候选再用 `index % candidates.length` 选择航班；保持候选为空返回 `null`；验证命令同 1.1。
- [x] 1.3 RED：补充 negative test，落地、缺经纬度、ETA 不在 5-15 分钟的航班不参与轮转；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`。
- [x] 1.4 GREEN：确认 `isPositionedAirborne` / `hasUsableEta` 过滤只作用于候选列表，修复失败；验证命令同 1.3。

## 2. CinemaState 写回 DEMO 主角

- [x] 2.1 RED：在 `frontend/src/tests/cinema-controller.test.tsx` 或 `cinema-ui.test.tsx` 增加 `setDemoProtagonist` action 测试，调用后 `ProtagonistBadge` 从旧 DEMO 切到新 DEMO；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx cinema-ui.test.tsx`。
- [x] 2.2 GREEN：在 `frontend/src/components/cinema/cinemaMachine.ts` 增加 `setDemoProtagonistState`，在 `CinemaContext.tsx` 暴露 `setDemoProtagonist`；验证命令同 2.1。
- [x] 2.3 RED：在 `frontend/src/tests/auto-seeder.test.tsx` 增加 establish cycle 测试，AutoSeeder 选择第 N 个 DEMO 后 Badge/Probe 显示该航班，且 seed-demo body 使用同一个 protagonist_name；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 2.4 GREEN：修改 `frontend/src/components/cinema/AutoSeeder.tsx`，增加 `demoSelectionOffset` prop，按 `offset + cycleId - 1` 选择 DEMO，先写回 `setDemoProtagonist` 再 POST `/seed-demo`；验证命令同 2.3。
- [x] 2.5 RED：补充 AutoSeeder 不覆盖 REAL 当前主角或待播 REAL queue 的 regression test；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx protagonist-queue.test.ts`。
- [x] 2.6 GREEN：在 AutoSeeder establish 分支中跳过 REAL current/queue，保持 REAL 优先；验证命令同 2.5。

## 3. TowerShell session-only seed 接入

- [x] 3.1 RED：在 `frontend/src/tests/tower-shell.test.tsx` 增加测试，mock `Math.random` 后 `CinemaProvider.initialProtagonist` 使用 seed 对应候选而非第一候选；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。
- [x] 3.2 GREEN：在 `frontend/src/routes/TowerShell.tsx` 用 `useRef` 生成 session-only demo seed，并传给初始 `chooseDemoProtagonist` 与 `AutoSeeder demoSelectionOffset`；验证命令同 3.1。
- [x] 3.3 RED：增加测试确认不读取/写入 `localStorage`、`sessionStorage` 或 cookie，并且 live flights re-render 不重置 seed；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。
- [x] 3.4 GREEN：修正 TowerShell provider key 或 seed 生命周期，避免 live polling 意外 remount/reseed；验证命令同 3.3。

## 4. REAL policy.created timestamp 归一化

- [x] 4.1 RED：在 `frontend/src/tests/event-choreographer.test.tsx` 增加秒级 `created_at: Math.floor(Date.now() / 1000)` 的 `policy.created` 用例，断言 `REAL · LIVE` 立即抢占；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.2 GREEN：在 `frontend/src/components/cinema/EventChoreographer.tsx` 增加并导出 `normalizeCreatedAtMs(value, fallback)`，`realPolicyCreatedFromEvent` 使用归一化时间；验证命令同 4.1。
- [x] 4.3 RED：补充毫秒级 `created_at` 仍可抢占、非 number 使用 `event.receivedAt` fallback、旧秒级事件仍被 60s lookback 丢弃的边界测试；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx protagonist-queue.test.ts`。
- [x] 4.4 GREEN：修复归一化边界失败，确保不改变 burst / stale 规则；验证命令同 4.3。
- [x] 4.5 检查 `frontend/src/components/cinema/ambientHeatmap.ts`、`keyMoments.ts`、`keyMomentTimeline.ts`、`protagonist.ts` 的时间字段处理；若已有归一化或使用 `receivedAt`，在 self-review 记录；如发现同类 bug，先补 RED 测试再修。

## 5. 集成回归与验证

- [x] 5.1 聚焦回归：运行 `cd frontend && pnpm test -- protagonist-queue.test.ts auto-seeder.test.tsx event-choreographer.test.tsx tower-shell.test.tsx cinema-controller.test.tsx`，修复失败。
- [x] 5.2 全前端回归：运行 `cd frontend && pnpm test`。
- [x] 5.3 后端回归：运行 `.venv/bin/pytest backend/tests -q`，确认本次无后端退化。
- [x] 5.4 类型与构建：运行 `cd frontend && pnpm exec tsc --noEmit && pnpm build`。
- [x] 5.5 OpenSpec 验证：运行 `openspec validate cinema-experience-followup-rotation-and-timestamp --strict --no-interactive`。
- [x] 5.6 graphify 同步：运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 5.7 最终 self-review：对照用户两条原话、`cinema-engine` MODIFIED scenario、时间戳 bug 修复链路、C2/C3 共存场景，列“已覆盖 / 部分覆盖 / 未覆盖”，修复后重跑相关测试。
