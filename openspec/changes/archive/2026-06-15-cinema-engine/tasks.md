## 1. 后端 demo API 与事件契约

- [x] 1.1 RED：在 `backend/tests/integration/test_seed_demo.py` 增加 `/seed-demo` 测试：body 含 `protagonist_name`，断言返回 `protagonist_name`、`flight_id`、`policy_ids` 且不需要浏览器携带 `X-Admin-Token`；验证命令：`pytest backend/tests/integration/test_seed_demo.py -q`，预期先失败。
- [x] 1.2 GREEN：修改 `backend/admin/routes.py` 的 `SeedDemoRequest/SeedDemoResponse` 与 seed 逻辑，抽出共享 helper，保留 `/admin/seed-demo`，新增 cinema 入口 `/seed-demo`；验证命令：`pytest backend/tests/integration/test_seed_demo.py -q`。
- [x] 1.3 RED：在 `backend/tests/integration/test_admin_routes.py` 增加 `/inject-delay` cinema 入口测试，覆盖成功、未知航班、demo 关闭或未授权错误；验证命令：`pytest backend/tests/integration/test_admin_routes.py -q`，预期先失败。
- [x] 1.4 GREEN：修改 `backend/admin/routes.py`，复用现有延误注入 helper，保留 `/admin/inject-delay` token 保护，新增 `/inject-delay` 的 cinema 安全入口；验证命令：`pytest backend/tests/integration/test_admin_routes.py -q`。
- [x] 1.5 RED：在 `backend/tests/unit/test_claim_engine.py` 增加 `claim.settled` payload 测试，断言 `tx_hash` 为 `0x` + 40 hex、`block_height` 递增，并且旧 `flare` 仍广播；验证命令：`pytest backend/tests/unit/test_claim_engine.py -q`，预期先失败。
- [x] 1.6 GREEN：修改 `backend/claims/engine.py`，增加 mock tx hash/block height 生成与 `claim.settled` 广播，保留旧 `flare`；验证命令：`pytest backend/tests/unit/test_claim_engine.py -q`。
- [x] 1.7 RED：在 `backend/tests/unit/test_claim_engine.py` 增加 `flight.landed` 广播测试，断言 settlement 后发出 `flight.landed` 且 payload 含 `flight_id/policy_id/landed_at/source`；验证命令：`pytest backend/tests/unit/test_claim_engine.py::test_run_once_broadcasts_flight_landed_after_settlement -q`，预期先失败。
- [x] 1.8 GREEN：修改 `backend/claims/engine.py` 与必要的 `backend/ws/broadcaster.py` enum，发射 `flight.landed`；验证命令：`pytest backend/tests/unit/test_claim_engine.py backend/tests/unit/test_broadcaster.py -q`。

## 2. Cinema 状态机与 Provider

- [x] 2.1 RED：新增 `frontend/src/tests/cinema-controller.test.tsx`，用 fake timers 测默认 cinema、5s 后 phase/camera target、30s cycle 循环；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`，预期先失败。
- [x] 2.2 GREEN：新增 `frontend/src/components/cinema/CinemaContext.tsx` 与 `frontend/src/components/cinema/cinemaMachine.ts`，实现 mode/phase/cycleId/protagonist/cameraTarget 的最小 reducer；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`。
- [x] 2.3 RED：扩展 `frontend/src/tests/cinema-controller.test.tsx`，覆盖 click/wheel/drag/keydown 进入 `interactive`、manual 倒计时从 30s 开始；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`，预期先失败。
- [x] 2.4 GREEN：新增 `frontend/src/components/cinema/CinemaController.tsx`，注册全局接管事件并维护 idle timer；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`。
- [x] 2.5 RED：扩展同一测试覆盖 idle 30s 自动恢复、Esc 立即恢复、mousemove/hover 不接管；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`，预期先失败。
- [x] 2.6 GREEN：完善 `CinemaController.tsx` 的 idle reset、Esc resume、忽略 mousemove 逻辑；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`。
- [x] 2.7 RED：扩展同一测试覆盖 `visibilitychange=hidden` 暂停、visible 后新 cycle 恢复；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`，预期先失败。
- [x] 2.8 GREEN：在 `CinemaController.tsx` 实现 visibility handling 和 timer 清理；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`。

## 3. 主角选择与 AutoSeeder

- [x] 3.1 RED：新增 `frontend/src/tests/auto-seeder.test.tsx`，测试无真实事件时从 live flights 选择 `on_ground=false` 且有经纬度的 DEMO 主角；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`，预期先失败。
- [x] 3.2 GREEN：新增 `frontend/src/components/cinema/protagonist.ts`，实现 DEMO 名字池与主角选择 helper；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 3.3 RED：扩展 `auto-seeder.test.tsx`，测试 establish 调 `/api/seed-demo` 且 body 含 `protagonist_name`，第 12 秒调 `/api/inject-delay`；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`，预期先失败。
- [x] 3.4 GREEN：新增 `frontend/src/components/cinema/AutoSeeder.tsx`，用 `apiFetch` 实现 seed/inject timer；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 3.5 RED：扩展 `auto-seeder.test.tsx`，测试每 cycle 最多 seed/inject 各一次，interactive/hidden/degraded 时不发请求；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`，预期先失败。
- [x] 3.6 GREEN：完善 `AutoSeeder.tsx` 的 cycleId 去重、状态守卫和 cleanup；验证命令：`cd frontend && pnpm test -- auto-seeder.test.tsx`。
- [x] 3.7 RED：新增 `frontend/src/tests/protagonist-queue.test.ts`，覆盖 REAL 在 establish/rest 立即抢占、story 排队、队列最多 3 条、旧事件丢弃；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`，预期先失败。
- [x] 3.8 GREEN：完善 `frontend/src/components/cinema/protagonist.ts` 的 REAL 队列与抢占规则；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`。

## 4. WebSocket 事件编排与 KPI tick

- [x] 4.1 RED：在 `frontend/src/tests/useWebSocket.test.ts` 增加 `claim.settled`、`policy.created`、`flight.landed` 解析入事件 buffer 的测试，确保旧 `flare` 仍进入 flares；验证命令：`cd frontend && pnpm test -- useWebSocket.test.ts`，预期先失败。
- [x] 4.2 GREEN：修改 `frontend/src/store/eventStore.ts` 与 `frontend/src/hooks/useWebSocket.ts`，新增 typed events ring buffer 和兼容 flare 处理；验证命令：`cd frontend && pnpm test -- useWebSocket.test.ts eventStore.test.ts`。
- [x] 4.3 RED：新增 `frontend/src/tests/event-choreographer.test.tsx`，测试 `claim.settled` 与旧 `flare` 都触发 KPI tick，`flight.landed` 不渲染 C2 动效；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.4 GREEN：新增 `frontend/src/components/cinema/EventChoreographer.tsx`，只路由 KPI tick 与 REAL 队列入口；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.5 RED：在 `frontend/src/tests/tower-components.test.tsx` 增加 `KPIBand` tick class/aria 状态测试；验证命令：`cd frontend && pnpm test -- tower-components.test.tsx`，预期先失败。
- [x] 4.6 GREEN：修改 `frontend/src/components/tower/KPIBand.tsx`，根据 tick id 触发数字 tick 动效并保持现有统计；验证命令：`cd frontend && pnpm test -- tower-components.test.tsx`。

## 5. CameraDirector 与 GlobeMap 接入

- [x] 5.1 RED：新增 `frontend/src/tests/camera-director.test.ts`，测试经纬度 + size + zoom 计算目标 viewport，且 zoom-out 回全球；验证命令：`cd frontend && pnpm test -- camera-director.test.ts`，预期先失败。
- [x] 5.2 GREEN：新增 `frontend/src/components/cinema/CameraDirector.tsx` 与 `frontend/src/components/cinema/cameraMath.ts`，实现 deterministic viewport helper；验证命令：`cd frontend && pnpm test -- camera-director.test.ts`。
- [x] 5.3 RED：在 `frontend/src/tests/tower-shell.test.tsx` 或新增 `globe-map-camera.test.tsx`，测试 `GlobeMap` 接收 `cameraTarget` 后应用 viewport，wheel/drag/click 调 `onUserGesture`；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx`，预期先失败。
- [x] 5.4 GREEN：修改 `frontend/src/components/tower/GlobeMap.tsx`，增加 `cameraTarget/onUserGesture` props、RAF 插值和手势取消；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx tower-shell.test.tsx`。

## 6. C1 UI 组件与 TowerShell 组合

- [x] 6.1 RED：新增 `frontend/src/tests/cinema-ui.test.tsx`，测试 `ModeIndicator` 显示 `CINEMA`、`MANUAL · 30s`、`DATA LINK LOST · retry`；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx`，预期先失败。
- [x] 6.2 GREEN：新增 `frontend/src/components/cinema/ModeIndicator.tsx`，按 context/wsState 渲染状态；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx`。
- [x] 6.3 RED：扩展 `cinema-ui.test.tsx`，测试 `ProtagonistBadge` 显示 `DEMO`、`DEMO · OFFLINE`、`REAL · LIVE`、`+N more`；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx`，预期先失败。
- [x] 6.4 GREEN：新增 `frontend/src/components/cinema/ProtagonistBadge.tsx` 与 `CinemaOverlay.tsx` 空容器，确保 `pointer-events: none`；验证命令：`cd frontend && pnpm test -- cinema-ui.test.tsx`。
- [x] 6.5 RED：扩展 `frontend/src/tests/tower-components.test.tsx`，测试 `RadarSweep` 在 at-risk 时显示 `AT RISK`，非 at-risk 不显示；验证命令：`cd frontend && pnpm test -- tower-components.test.tsx`，预期先失败。
- [x] 6.6 GREEN：修改 `frontend/src/components/tower/RadarSweep.tsx`，增加 `atRisk`/主角 props 与标签；验证命令：`cd frontend && pnpm test -- tower-components.test.tsx`。
- [x] 6.7 RED：更新 `frontend/src/tests/tower-shell.test.tsx`，断言 `TowerShell` 包含 CinemaProvider/Controller/AutoSeeder/EventChoreographer/Overlay/ModeIndicator 并仍能点击飞机导航；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`，预期先失败。
- [x] 6.8 GREEN：修改 `frontend/src/routes/TowerShell.tsx` 组合所有 C1 组件，传递 `cameraTarget`、`atRisk`、manual gesture handler；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx tower-components.test.tsx`。

## 7. 集成验证与回归

- [x] 7.1 RED：新增或扩展 `frontend/e2e/dashboard.spec.ts`，覆盖打开 `/` 5s 后出现 cinema zoom/主角 badge、点击飞机后 `MANUAL · 30s`、Esc 恢复；验证命令：`cd frontend && pnpm exec playwright test e2e/dashboard.spec.ts --project=chromium`，预期在实现前失败或标注需本地服务。
- [x] 7.2 GREEN：补齐必要 aria/testid 与稳定样式，不改变视觉范围；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx auto-seeder.test.tsx event-choreographer.test.tsx camera-director.test.ts cinema-ui.test.tsx tower-shell.test.tsx tower-components.test.tsx`。
- [x] 7.3 后端回归：运行 `pytest backend/tests -q`，修复由 seed-demo、ClaimEngine、WebSocket 事件扩展引起的兼容问题。
- [x] 7.4 前端回归：运行 `cd frontend && pnpm test`，修复 eventStore/useWebSocket/TowerShell 相关失败。
- [x] 7.5 构建检查：运行 `cd frontend && pnpm build`，修复 TypeScript 或 Vite build 问题。
- [x] 7.6 OpenSpec 一致性：对照 `openspec/changes/cinema-engine/specs/cinema-engine/spec.md` 每个 scenario 更新实现覆盖说明，必要时调整测试名；验证命令：`openspec validate cinema-engine --strict --no-interactive`。
- [x] 7.7 Graphify 更新：修改代码后运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`，保证 `graphify-out/` 同步。
- [x] 7.8 最终自审：按设计文档 §6、§7、§9 逐条核对接管/恢复、AutoSeeder、错误处理，记录 self-review 问题并修复后重跑 `pytest backend/tests -q`、`cd frontend && pnpm test`、`openspec validate cinema-engine --strict --no-interactive`。
- [x] 7.9 RED/GREEN：补 REAL `policy.created` 接入 `EventChoreographer` 与 Cinema 主角队列，覆盖 establish/rest 立即 REAL、story 入队不打断；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx cinema-ui.test.tsx`。
- [x] 7.10 RED/GREEN：补 WS reconnect 恢复 cinema 测试，覆盖 `retrying -> open` 恢复 cinema、manual 时保持 interactive；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx cinema-ui.test.tsx`。
