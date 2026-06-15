## 1. Cinema 状态机取消自动 zoom

- [x] 1.1 RED：更新 `frontend/src/tests/cinema-controller.test.tsx` 或新增 `cinema-machine-spotlight.test.ts`，断言 `zoom-in` / `story` / `zoom-out` phase 的 `cameraTarget` 均为 `null`；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx camera-director.test.ts`，预期先失败。
- [x] 1.2 GREEN：修改 `frontend/src/components/cinema/cinemaMachine.ts`，让 `cameraTargetForPhase()` 在默认 cinema 播放中返回 `null`，保留 `CameraTarget` 类型和 prop；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx camera-director.test.ts`。
- [x] 1.3 RED：补 30 秒 cycle 回归测试，断言新 cycle 不产生 `global` zoom-out target，phase/cycleId 仍按 0/5/7/25/27/30s 推进；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`，预期先失败。
- [x] 1.4 GREEN：调整 `advanceCinemaState()` 中 cycle/camera target 赋值，保持 phase 时间线但不写 viewport target；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx`。
- [x] 1.5 RED：更新 `frontend/src/tests/camera-director.test.ts`，断言 CameraDirector 默认把 `null` cameraTarget 传给 children，且兼容显式 legacy target；验证命令：`cd frontend && pnpm test -- camera-director.test.ts`，预期先失败或暴露旧断言。
- [x] 1.6 GREEN：必要时微调 `CameraDirector.tsx` 测试 helper，不删除组件或 prop；验证命令：`cd frontend && pnpm test -- camera-director.test.ts`。

## 2. GlobeMap 主角 spotlight 高亮

- [x] 2.1 RED：扩展 `frontend/src/tests/globe-map-camera.test.tsx`，断言传入 protagonist highlight 后匹配航班点带 `data-protagonist="true"`，且 viewport transform 仍为全球默认；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx`，预期先失败。
- [x] 2.2 GREEN：在 `frontend/src/components/tower/GlobeMap.tsx` 增加 `protagonistHighlight` 可选 prop、匹配 helper 和 SVG ring/pulse class，不改现有 `cameraTarget` prop；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx`。
- [x] 2.3 RED：补点击高亮主角飞机仍触发 `onSelectFlight`、wheel/drag 仍触发 `onUserGesture` 的 regression；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx tower-shell.test.tsx`，预期先失败。
- [x] 2.4 GREEN：确保 spotlight ring `pointer-events: none`，飞机点击 handler 保留在原 dot 上；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx tower-shell.test.tsx`。
- [x] 2.5 RED：更新 `frontend/src/tests/tower-shell.test.tsx`，断言 TowerShell 把当前 protagonist 传给 GlobeMap，且 `mock-globe` 不再收到 `cameraTarget.reason="protagonist"`；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`，预期先失败。
- [x] 2.6 GREEN：修改 `frontend/src/routes/TowerShell.tsx`，把 cinema protagonist 传给 `GlobeMap.protagonistHighlight`，CameraDirector 仍保留但输出 null；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。
- [x] 2.7 RED/GREEN：补 reduced motion 或静态高亮测试，确保 spotlight 不依赖新增动画库；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx`。

## 3. REAL 任意 phase 立即抢占与 burst 队列

- [x] 3.1 RED：扩展 `frontend/src/tests/protagonist-queue.test.ts`，断言 story/zoom-in/zoom-out phase 收到 REAL `policy.created` 立即切换 protagonist，不再排队等待；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`，预期先失败。
- [x] 3.2 GREEN：修改 `routeRealProtagonistState()`，任意 phase 对首个 REAL 事件立即设置 REAL protagonist、`phase="establish"`、`cycleStartedAt=now`、`cameraTarget=null`；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts cinema-controller.test.tsx`。
- [x] 3.3 RED：补 REAL 抢占时 `cycleId` 或 reset token 单调递增、`ProtagonistBadge` 显示 `REAL · LIVE` 的测试；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts cinema-ui.test.tsx`，预期先失败。
- [x] 3.4 GREEN：给 `CinemaState` 增加 `storyResetId` 或等价字段，并在 `CinemaContext` 暴露；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts cinema-ui.test.tsx`。
- [x] 3.5 RED：补 burst 测试，0ms 第一条 REAL 立即抢占，999ms 内第二/第三条进入队列，1000ms 后下一条可再次立即抢占；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`，预期先失败。
- [x] 3.6 GREEN：实现 `lastRealTakeoverAt` / burst window 逻辑，保留 queue cap=3 和 `+N more` badge；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts cinema-ui.test.tsx`。
- [x] 3.7 RED：补旧 REAL 事件 lookback 60s 仍丢弃的 regression；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`，预期先失败或确认旧行为仍受保护。
- [x] 3.8 GREEN：确保 lookback guard 在立即抢占和 burst 入队前执行；验证命令：`cd frontend && pnpm test -- protagonist-queue.test.ts`。

## 4. REAL 抢占清空 C2/C3 transient moments

- [x] 4.1 RED：扩展 `frontend/src/tests/key-moment-timeline.test.ts` 或 `cinema-key-moments-integration.test.tsx`，断言 `useKeyMomentQueue.clearAllMoments()` 可清空 active 与 pending；验证命令：`cd frontend && pnpm test -- key-moment-timeline.test.ts cinema-key-moments-integration.test.tsx`，预期先失败。
- [x] 4.2 GREEN：在 `frontend/src/components/cinema/useKeyMomentQueue.ts` 暴露 `clearAllMoments()`，复用 `createKeyMomentTimelineState()` 清空 timeline；验证命令：`cd frontend && pnpm test -- key-moment-timeline.test.ts cinema-key-moments-integration.test.tsx`。
- [x] 4.3 RED：扩展 `frontend/src/tests/cinema-key-moments-integration.test.tsx`，mock active ShockWave 后推 REAL `policy.created`，断言 ShockWave/ChainBeam/FlareLand 被移除且 badge 切 REAL；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx`，预期先失败。
- [x] 4.4 GREEN：在 `TowerShell.tsx` 监听 cinema reset token，调用 `keyMomentQueue.clearAllMoments()`；验证命令：`cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx`。
- [x] 4.5 RED：扩展 `frontend/src/tests/cinema-ambient-integration.test.tsx`，在 TrailDraw active 时推 REAL `policy.created`，断言旧 TrailDraw DOM 清理，新 REAL cycle 从 establish 重启；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx`，预期先失败。
- [x] 4.6 GREEN：让 `useTrailDraw` 或 TowerShell trail layer 响应 reset token，清空旧 active trail/timer；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx use-trail-draw.test.tsx`。
- [x] 4.7 RED/GREEN：确认 `eventStore.events` 不因清场被删除，KPI tick 与 Claims/Feed 兼容路径仍保留；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx eventStore.test.ts`。

## 5. E2E smoke 与文案断言更新

- [x] 5.1 RED：更新 `frontend/e2e/dashboard.spec.ts` smoke 断言，从 `scale(5)` 改为 protagonist highlight testid/data attribute；验证命令：`cd frontend && pnpm exec playwright test`，默认沙箱应明确 skip，`PLAYWRIGHT_USE_LOCAL_SERVER=1` 时断言新行为。
- [x] 5.2 GREEN：确保 `GlobeMap` 或 TowerShell 暴露稳定 protagonist highlight selector，e2e 不再依赖 viewport scale；验证命令：`cd frontend && pnpm test -- globe-map-camera.test.tsx tower-shell.test.tsx`。
- [x] 5.3 RED/GREEN：更新测试名称和注释，明确 “spotlight no zoom” 行为，避免后续误读；验证命令：`cd frontend && pnpm test -- cinema-controller.test.tsx camera-director.test.ts globe-map-camera.test.tsx`。

## 6. 回归、验证与自审

- [x] 6.1 聚焦回归：运行 `cd frontend && pnpm test -- cinema-controller.test.tsx camera-director.test.ts globe-map-camera.test.tsx protagonist-queue.test.ts tower-shell.test.tsx`，修复 spotlight/no-zoom 相关失败。
- [x] 6.2 Moment 清场回归：运行 `cd frontend && pnpm test -- cinema-key-moments-integration.test.tsx cinema-ambient-integration.test.tsx key-moment-timeline.test.ts use-trail-draw.test.tsx`，确认 C2/C3 清场和非抢占路径都正确。
- [x] 6.3 全前端回归：运行 `cd frontend && pnpm test`，修复所有 Vitest 失败。
- [x] 6.4 后端回归：运行 `.venv/bin/pytest backend/tests -q`，确认无后端回退。
- [x] 6.5 前端 build：运行 `cd frontend && pnpm build`。
- [x] 6.6 OpenSpec 验证：运行 `openspec validate cinema-experience-tuning --strict --no-interactive`。
- [x] 6.7 graphify 同步：运行 `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 6.8 最终 self-review：对照用户两条原话、design 决策 1-6、`cinema-engine` delta 每个 scenario，列“已覆盖 / 部分覆盖 / 未覆盖”，修复问题后重跑相关测试。
