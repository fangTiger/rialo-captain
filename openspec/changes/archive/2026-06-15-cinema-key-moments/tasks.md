## 1. 后端 claim.triggered 事件

- [x] 1.1 RED：在 `backend/tests/unit/test_broadcaster.py` 增加 `EventType.CLAIM_TRIGGERED == "claim.triggered"` 测试；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_broadcaster.py -q`，预期先失败。
- [x] 1.2 GREEN：修改 `backend/ws/broadcaster.py`，新增 `CLAIM_TRIGGERED` enum，不改现有 enum 值；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_broadcaster.py -q`。
- [x] 1.3 RED：在 `backend/tests/unit/test_claim_engine.py` 增加 `claim.triggered` 广播测试，断言事件在 `claim.settled` 前，payload 含 `flight_id/policy_id/delay_minutes/source/airport_iata` 或经纬度；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py::test_run_once_broadcasts_claim_triggered_before_settlement -q`，预期先失败。
- [x] 1.4 GREEN：修改 `backend/claims/engine.py`，在 condition 命中后、`adapter.trigger_claim()` 前广播 `EventType.CLAIM_TRIGGERED`，payload 从 `Policy`/`Flight`/observation 取最小字段；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py::test_run_once_broadcasts_claim_triggered_before_settlement -q`。
- [x] 1.5 RED：扩展 `backend/tests/unit/test_claim_engine.py`，覆盖未命中 delay 时不广播 `claim.triggered`，以及 `claim.settled/flight.landed/flare` payload 不新增字段；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py -q`，预期先失败。
- [x] 1.6 GREEN：完善 `backend/claims/engine.py` 的 payload helper 与广播顺序，确保未命中条件提前 return；验证命令：`.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py backend/tests/unit/test_broadcaster.py -q`。

## 2. Key Moment 纯函数与类型

- [x] 2.1 RED：新增 `frontend/src/tests/key-moments.test.ts`，测试 `claim.triggered` payload 归一化为 ShockWave moment，缺少 `flight_id/policy_id` 时返回 null；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`，预期先失败。
- [x] 2.2 GREEN：新增 `frontend/src/components/cinema/keyMoments.ts`，定义 `KeyMoment` 类型和 `momentFromEvent()` 的 trigger 分支；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`。
- [x] 2.3 RED：扩展 `key-moments.test.ts`，测试 `claim.settled` 归一化为 ChainBeam moment，要求 tx hash 短格式来自 payload `tx_hash`，同样 payout 也不影响 moment id；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`，预期先失败。
- [x] 2.4 GREEN：完善 `keyMoments.ts` 的 settled 分支，保留 C1 KPI tick 不相关逻辑；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`。
- [x] 2.5 RED：扩展 `key-moments.test.ts`，测试 `flight.landed` 归一化为 FlareLand moment，并忽略缺少 flight/policy 的 payload；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`，预期先失败。
- [x] 2.6 GREEN：完善 `keyMoments.ts` 的 landed 分支；验证命令：`cd frontend && pnpm test -- key-moments.test.ts`。
- [x] 2.7 RED：新增 `frontend/src/tests/key-moment-geometry.test.ts`，测试 `projectMomentPoint()` 使用 `projectLonLat + viewport` 得到屏幕坐标，`hangarAnchorForSize()` 固定右上锚点；验证命令：`cd frontend && pnpm test -- key-moment-geometry.test.ts`，预期先失败。
- [x] 2.8 GREEN：新增 `frontend/src/components/cinema/keyMomentGeometry.ts`，实现坐标投影、IATA fallback 与 hangar anchor 纯函数；验证命令：`cd frontend && pnpm test -- key-moment-geometry.test.ts`。
- [x] 2.9 RED：新增 `frontend/src/tests/key-moment-timeline.test.ts`，测试 STORY gate：trigger 到 15s 释放，settled 在 ShockWave 后约 1s，landed 在 ChainBeam 后约 4s，非主角/旧事件丢弃；验证命令：`cd frontend && pnpm test -- key-moment-timeline.test.ts`，预期先失败。
- [x] 2.10 GREEN：在 `frontend/src/components/cinema/keyMomentTimeline.ts` 实现 pending/active 计算、TTL、active cap=6；验证命令：`cd frontend && pnpm test -- key-moment-timeline.test.ts`。

## 3. C2 视觉组件

- [x] 3.1 RED：新增 `frontend/src/tests/key-moment-components.test.tsx`，测试 `ShockWave` 渲染 `data-testid="shockwave"`、delay 文案、ring class/style 且 `pointer-events: none`；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`，预期先失败。
- [x] 3.2 GREEN：新增 `frontend/src/components/cinema/ShockWave.tsx` 与必要 CSS，使用 transform/opacity ring 动画；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`。
- [x] 3.3 RED：扩展 `key-moment-components.test.tsx`，测试 `ChainBeam` 渲染 `data-testid="chainbeam"`、SVG line、pulse、短 tx hash，tx hash 文本 `will-change: transform`；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`，预期先失败。
- [x] 3.4 GREEN：新增 `frontend/src/components/cinema/ChainBeam.tsx`，使用 SVG line + CSS pulse + tx label，不引入动画依赖；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`。
- [x] 3.5 RED：扩展 `key-moment-components.test.tsx`，测试 `FlareLand` 渲染 `data-testid="flareland"`、`FLARE` 文案、ping ring，且不拦截事件；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`，预期先失败。
- [x] 3.6 GREEN：新增 `frontend/src/components/cinema/FlareLand.tsx`，实现落地收束/ping 视觉；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`。
- [x] 3.7 RED：扩展 `key-moment-components.test.tsx`，mock `prefers-reduced-motion: reduce`，断言三组件加 reduced class/静态状态且不含 pulse/scale animation class；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`，预期先失败。
- [x] 3.8 GREEN：新增 `frontend/src/components/cinema/useReducedMotion.ts` 或 CSS media query 支持 reduced motion；验证命令：`cd frontend && pnpm test -- key-moment-components.test.tsx`。

## 4. EventChoreographer C2 路由

- [x] 4.1 RED：修改 `frontend/src/tests/event-choreographer.test.tsx`，把 C1 负例改成 C2 正例：`claim.triggered` 调 `onClaimTriggered` 且不触发 KPI；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.2 GREEN：修改 `frontend/src/components/cinema/EventChoreographer.tsx`，增加 `onClaimTriggered` callback 和 trigger payload 归一化；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.3 RED：扩展 `event-choreographer.test.tsx`，测试 `claim.settled` 同时触发 KPI tick 与 `onClaimSettled`，相同 payout 的不同 event id 仍触发；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.4 GREEN：完善 `EventChoreographer.tsx` 的 settled callback，保留 flare 兼容路径；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.5 RED：扩展 `event-choreographer.test.tsx`，测试 `flight.landed` 调 `onFlightLanded`，并断言 `heatmap-bg`、`trail-draw` 仍不渲染；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.6 GREEN：完善 `EventChoreographer.tsx` 的 landed callback 和 C3 no-op；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.7 TEST：扩展 `event-choreographer.test.tsx`，测试 EventChoreographer 不按当前主角过滤 C2 callback，且重复 event id 不重复 callback；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，现有 `seenIdsRef` 已覆盖去重所以直接通过。
- [x] 4.8 REFACTOR：完善 `EventChoreographer.tsx` 的 callback 去重边界，保持主角/pending/active 过滤由 TowerShell timeline 负责；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。

## 5. TowerShell 与 CinemaOverlay 集成

- [x] 5.1 RED：修改 `frontend/src/tests/tower-shell.test.tsx`，断言 TowerShell 传递 `GlobeMap.onViewportChange` 并在 overlay 中保留 `ProtagonistBadge`；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`，预期先失败。
- [x] 5.2 GREEN：修改 `frontend/src/routes/TowerShell.tsx`，维护 viewport state，传给 C2 moment 渲染逻辑；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。
- [x] 5.3 RED：扩展 `tower-shell.test.tsx` 或新增 `frontend/src/tests/cinema-key-moments-integration.test.tsx`，mock WS 推当前主角 `claim.triggered`，断言 overlay 出现 ShockWave；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx tower-shell.test.tsx`，预期先失败。
- [x] 5.4 GREEN：在 TowerShell/CinemaOverlay 内渲染 ShockWave moments，确保 `pointer-events: none`；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx tower-shell.test.tsx`。
- [x] 5.5 RED：扩展 integration 测试，mock `claim.settled` 后断言 ChainBeam 出现、tx hash 短格式显示、KPI tick id 仍更新；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx event-choreographer.test.tsx`，预期先失败。
- [x] 5.6 GREEN：接入 ChainBeam moment 渲染与 cleanup；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx event-choreographer.test.tsx`。
- [x] 5.7 RED：扩展 integration 测试，mock `flight.landed` 后断言 FlareLand 出现并在 TTL 后清理；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx`，预期先失败。
- [x] 5.8 GREEN：接入 FlareLand moment 渲染与 cleanup；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx tower-shell.test.tsx`。
- [x] 5.9 TEST：扩展 `cinema-key-moments-integration.test.tsx`，断言 C2 动效存在时点击飞机导航和 manual gesture 仍保持 C1 行为；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx tower-shell.test.tsx`，现有 overlay/GlobeMap 语义已满足所以直接通过。
- [x] 5.10 GREEN：确认 overlay/层级/props，确保 C2 不拦截地图交互；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx cinema-ui.test.tsx`。

## 6. STORY 时间线集成

- [x] 6.1 RED：新增 `frontend/src/tests/cinema-key-moments-timeline.test.tsx`，fake timers 下提前推三类事件，advance 到 14s 不显示，15s 显示 ShockWave；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx`，预期先失败。
- [x] 6.2 GREEN：在 TowerShell key moment 管理中接入 `keyMomentTimeline.ts`，按 phase/cycle elapsed 释放 ShockWave；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx`。
- [x] 6.3 TEST：扩展 timeline 测试，断言 1s 后 ChainBeam、4s 后 FlareLand，且各自 TTL 后清理；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx`，6.2 已接入完整 timeline 所以直接通过。
- [x] 6.4 GREEN：完善 timeline 调度与 cleanup timer refs；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx key-moment-timeline.test.ts`。
- [x] 6.5 TEST：扩展 timeline 测试，断言 burst 超过 6 个 active moments 时丢弃最旧，旧/非主角事件不显示；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx key-moment-timeline.test.ts`，6.2 已复用纯 timeline 所以直接通过。
- [x] 6.6 GREEN：完善 active cap、旧事件和非主角过滤；验证命令：`cd frontend && pnpm test -- cinema-key-moments-timeline.test.tsx key-moment-timeline.test.ts`。

## 7. 回归与验收

- [x] 7.1 前端 focused 回归：运行 `cd frontend && pnpm test -- key-moments.test.ts key-moment-geometry.test.ts key-moment-timeline.test.ts key-moment-components.test.tsx event-choreographer.test.tsx cinema-key-moments-integration.test.tsx cinema-key-moments-timeline.test.tsx tower-shell.test.tsx`，修复 C2 相关失败。
- [x] 7.2 后端回归：运行 `.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py backend/tests/unit/test_broadcaster.py -q`，修复 `claim.triggered` 相关失败。
- [x] 7.3 全前端回归：运行 `cd frontend && pnpm test`，修复 EventChoreographer、TowerShell、CinemaOverlay 回归。
- [x] 7.4 全后端回归：运行 `.venv/bin/python -m pytest backend/tests -q`，确认 C1/C2 后端事件兼容。
- [x] 7.5 构建检查：运行 `cd frontend && pnpm build`，修复 TypeScript/Vite build 问题。
- [x] 7.6 Playwright 验收：若本地后端会话不可用，保留或新增 skip 说明；若可用，运行 `cd frontend && pnpm exec playwright test e2e/dashboard.spec.ts --project=chromium`，覆盖 ShockWave/ChainBeam/FlareLand smoke。
- [x] 7.7 OpenSpec 校验：运行 `openspec validate cinema-key-moments --strict --no-interactive`，修复 proposal/spec/design/tasks 不一致。
- [x] 7.8 Graphify 更新：修改代码后运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`，同步 `graphify-out/`。
- [x] 7.9 最终自审：对照设计文档 §3、§4、§8.2、§9、§10、§11 与本 change spec 的每个 scenario，列出已覆盖/未覆盖/部分覆盖，修复问题后重跑 `cd frontend && pnpm test`、`.venv/bin/python -m pytest backend/tests -q`、`cd frontend && pnpm build`、`openspec validate cinema-key-moments --strict --no-interactive`。
