## 1. 后端 `policy.created` 广播

- [x] 1.1 RED：在 `backend/tests/unit/test_broadcaster.py` 增加 `EventType.POLICY_CREATED == "policy.created"` 断言；验证命令：`pytest backend/tests/unit/test_broadcaster.py -q`，预期先失败。
- [x] 1.2 GREEN：在 `backend/ws/broadcaster.py` 增加 `POLICY_CREATED` enum，不改现有 enum 值；验证命令：`pytest backend/tests/unit/test_broadcaster.py -q`。
- [x] 1.3 RED：在 `backend/tests/integration/test_policies_routes.py` 或现有 policy route 测试中 mock broadcaster，断言成功 `POST /policies` 后广播 `policy.created`，且 response schema 不变；验证命令：`pytest backend/tests/integration -q -k policy`，预期先失败。
- [x] 1.4 GREEN：在 `backend/policies/routes.py` 创建保单 commit 后广播 `policy.created`，payload 包含 `policy_id`、`flight_id`、`source="real"`、`created_at`、`callsign`；验证命令：`pytest backend/tests/integration -q -k policy`。
- [x] 1.5 RED：补坐标缺失用例，断言航班无经纬度时仍广播业务字段且不抛错；验证命令：`pytest backend/tests/integration -q -k policy_created`，预期先失败。
- [x] 1.6 GREEN：新增局部 helper 从 flight cache / `Flight.last_state` 尽力提取 `longitude`、`latitude`，缺失时省略坐标；验证命令：`pytest backend/tests/integration -q -k policy_created`。
- [x] 1.7 RED：补坐标存在用例，断言 payload 经纬度为数字且 callsign 来自航班；验证命令：`pytest backend/tests/integration -q -k policy_created`，预期先失败。
- [x] 1.8 GREEN：完善 payload helper 和测试 fixture，不改变 `PolicyPublic` 响应；验证命令：`pytest backend/tests/unit/test_broadcaster.py backend/tests/integration -q -k 'policy or broadcaster'`。

## 2. C3 纯函数与类型

- [x] 2.1 RED：新增 `frontend/src/tests/ambient-heatmap.test.ts`，断言有效 `policy.created` 转为 heat point；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`，预期先失败。
- [x] 2.2 GREEN：新增 `frontend/src/components/cinema/ambientHeatmap.ts` 的类型与 `heatPointFromPolicyEvent()`；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`。
- [x] 2.3 RED：补无坐标、非法经纬度、重复 event id 不生成点的 negative tests；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`，预期先失败。
- [x] 2.4 GREEN：完善 heat point 校验、dedupe 与错误安全返回；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`。
- [x] 2.5 RED：补 5 分钟 prune 和 raw point cap 的 fake timer/纯函数测试；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`，预期先失败。
- [x] 2.6 GREEN：实现 `pruneHeatPoints()`、`capHeatPoints()`、`selectHeatmapFocusPoints()`；验证命令：`cd frontend && pnpm test -- ambient-heatmap.test.ts`。
- [x] 2.7 RED：新增 `frontend/src/tests/trail-geometry.test.ts`，断言 heading 生成多点 path 且终点靠近主角；验证命令：`cd frontend && pnpm test -- trail-geometry.test.ts`，预期先失败。
- [x] 2.8 GREEN：新增 `frontend/src/components/cinema/trailGeometry.ts`，实现 `buildTrailPoints()` 与 projection helper；验证命令：`cd frontend && pnpm test -- trail-geometry.test.ts`。
- [x] 2.9 RED：补缺少 heading 使用 deterministic fallback、坐标不可解析返回 null 的测试；验证命令：`cd frontend && pnpm test -- trail-geometry.test.ts`，预期先失败。
- [x] 2.10 GREEN：完善 fallback path 和 invalid guard，保持纯函数无 DOM/window 依赖；验证命令：`cd frontend && pnpm test -- trail-geometry.test.ts ambient-heatmap.test.ts`。

## 3. HeatmapBg 与 TrailDraw 视觉组件

- [x] 3.1 RED：新增 `frontend/src/tests/ambient-components.test.tsx`，断言 `HeatmapBg` 渲染 `data-testid="heatmap-bg"` SVG、radial gradient、无 canvas；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`，预期先失败。
- [x] 3.2 GREEN：新增 `frontend/src/components/cinema/HeatmapBg.tsx` 与 CSS class，使用 SVG radial-gradient 多焦点；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`。
- [x] 3.3 RED：补 HeatmapBg `pointer-events: none`、多点 cap 后 DOM 数有限、viewport 投影 class/style 的测试；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`，预期先失败。
- [x] 3.4 GREEN：完善 HeatmapBg props、focus 渲染和 style，保持动画只用 opacity/transform 或 SVG opacity；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`。
- [x] 3.5 RED：补 reduced motion 下 HeatmapBg 不带 breath 动画 class 的测试；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`，预期先失败。
- [x] 3.6 GREEN：复用 `useReducedMotion()`，实现 HeatmapBg 静态模式；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`。
- [x] 3.7 RED：补 `TrailDraw` 渲染 `data-testid="trail-draw"`、SVG path、stroke-dasharray 动画 class 的测试；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`，预期先失败。
- [x] 3.8 GREEN：新增 `frontend/src/components/cinema/TrailDraw.tsx` 和样式，普通模式使用 stroke dash 一笔画；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`。
- [x] 3.9 RED/GREEN：补 reduced motion 下 TrailDraw 完整 path、无 dash 动画 class 的测试并实现；验证命令：`cd frontend && pnpm test -- ambient-components.test.tsx`。

## 4. 事件编排与 C3 hooks

- [x] 4.1 RED：扩展 `frontend/src/tests/event-choreographer.test.tsx`，断言 `policy.created` 调用 `onPolicyCreated` 且不触发 KPI tick；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.2 GREEN：在 `EventChoreographer.tsx` 增加可选 `onPolicyCreated` callback，同时保留 REAL 主角队列逻辑；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`。
- [x] 4.3 RED：补重复 event id 只调用一次 `onPolicyCreated`，无坐标事件仍可交给 callback 由 heatmap helper 丢弃；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx`，预期先失败。
- [x] 4.4 GREEN：复用 `seenIdsRef` 覆盖 policy.created 去重，不改 C2 callbacks；验证命令：`cd frontend && pnpm test -- event-choreographer.test.tsx key-moments.test.ts`。
- [x] 4.5 RED：新增 `frontend/src/tests/use-ambient-heatmap.test.tsx`，断言 callback 入点、5 分钟 prune timer、unmount cleanup；验证命令：`cd frontend && pnpm test -- use-ambient-heatmap.test.tsx`，预期先失败。
- [x] 4.6 GREEN：新增 `frontend/src/components/cinema/useAmbientHeatmap.ts`，封装 raw points、focus points、timer cleanup；验证命令：`cd frontend && pnpm test -- use-ambient-heatmap.test.tsx`。
- [x] 4.7 RED：新增 `frontend/src/tests/use-trail-draw.test.tsx`，断言 phase 到 STORY 时触发一次、同 cycle/protagonist 不重复、interactive/hidden 不触发；验证命令：`cd frontend && pnpm test -- use-trail-draw.test.tsx`，预期先失败。
- [x] 4.8 GREEN：新增 `frontend/src/components/cinema/useTrailDraw.ts`，实现 STORY trigger、TTL cleanup 和 reduced invalid guard；验证命令：`cd frontend && pnpm test -- use-trail-draw.test.tsx`。

## 5. TowerShell 集成

- [x] 5.1 RED：扩展 `frontend/src/tests/tower-shell.test.tsx`，断言 TowerShell 挂载 HeatmapBg 底层和 TrailDraw overlay 挂载点；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`，预期先失败。
- [x] 5.2 GREEN：在 `frontend/src/routes/TowerShell.tsx` 加 `MapAtmosphereLayer`、`HeatmapBg`、`TrailDraw` 组合，不改现有导航 props；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。
- [x] 5.3 RED：新增 integration test，mock WS 推 `policy.created` 后断言 HeatmapBg 收到并渲染新增焦点；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx`，预期先失败。
- [x] 5.4 GREEN：把 `EventChoreographer.onPolicyCreated` 接到 `useAmbientHeatmap.addPolicyEvent`；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx event-choreographer.test.tsx`。
- [x] 5.5 RED：补 fake timers integration，推进到 6999ms 不显示 TrailDraw、7000ms STORY 后显示、10000ms 后清理；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx`，预期先失败。
- [x] 5.6 GREEN：把 `useTrailDraw` 接入 TowerShell，使用 current viewport/protagonist/live flights 生成 path；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx`。
- [x] 5.7 RED：补 C2 共存 regression，TrailDraw 与 ShockWave/ChainBeam 同时存在时 C2 testid 仍渲染且 TrailDraw 层级较低；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx cinema-key-moments-integration.test.tsx`，预期先失败。
- [x] 5.8 GREEN：调整 overlay child order / z-index，不改 C2 组件内部；验证命令：`cd frontend && pnpm test -- cinema-ambient-integration.test.tsx cinema-key-moments-integration.test.tsx`。
- [x] 5.9 RED：补点击飞机导航与 manual gesture 不被 HeatmapBg/TrailDraw 拦截的 regression；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`，预期先失败。
- [x] 5.10 GREEN：确保 C3 layer 全部 `pointer-events: none`，保留 GlobeMap `onSelectFlight` 和 `onUserGesture`；验证命令：`cd frontend && pnpm test -- tower-shell.test.tsx`。

## 6. 回归、构建与 OpenSpec 验证

- [x] 6.1 聚焦前端回归：运行 `cd frontend && pnpm test -- ambient-heatmap.test.ts trail-geometry.test.ts ambient-components.test.tsx event-choreographer.test.tsx use-ambient-heatmap.test.tsx use-trail-draw.test.tsx cinema-ambient-integration.test.tsx`，修复 C3 聚焦失败。
- [x] 6.2 Tower/Cinema 回归：运行 `cd frontend && pnpm test -- tower-shell.test.tsx cinema-key-moments-integration.test.tsx cinema-key-moments-timeline.test.tsx cinema-ui.test.tsx`，确认 C1/C2 不回退。
- [x] 6.3 后端回归：运行 `pytest backend/tests -q`，确认 `policy.created` 广播不破坏现有 policy/claim/admin/ws 测试。
- [x] 6.4 全前端回归：运行 `cd frontend && pnpm test`，修复所有 vitest 失败。
- [x] 6.5 前端 build：运行 `cd frontend && pnpm build`，确认 TypeScript 与 Vite build 通过。
- [x] 6.6 OpenSpec 验证：运行 `openspec validate cinema-ambient --strict --no-interactive`，并在必要时运行 `openspec validate cinema-engine --strict`。
- [x] 6.7 Playwright smoke：沿用本地后端不可用时 skip 策略，补 C3 注释或 mock，验证不伪造通过；命令：`cd frontend && pnpm exec playwright test`。
- [x] 6.8 最终 self-review：对照设计文档 §3、§8.3、§10、附录 A 和 `cinema-ambient` 每个 scenario，列“已覆盖 / 部分覆盖 / 未覆盖”并修复问题后重跑相关测试。
