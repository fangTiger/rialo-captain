# Tasks: card-navigation-and-flight-detail

每个 task bite-sized (2-5 分钟级)，含文件路径 + 代码要点 + 验证命令。Codex 按顺序实现，每个 task 完成后打 `[x]`。

## 1. 后端 · ClaimsService 加 flight_id 过滤

- [x] 1.1 修改 `backend/claims/service.py` 的 `ClaimsService.recent`，签名加 `flight_id: str | None = None`；为 None 时行为不变，非 None 时 join `Policy` 过滤 `Policy.flight_id == flight_id`；返回结果同时 select `Policy.flight_id`
- [x] 1.2 修改 `backend/claims/routes.py` 的 `claims_recent` 接受 `flight_id: str | None = Query(None)`，转发给 service；`ClaimPublic` 响应模型新增 `flight_id: str` 字段
- [x] 1.3 在 `backend/tests/integration/test_admin_routes.py` 或新建 `test_claims_routes.py` 加测试：seed 2 flight 各 1 claim，`GET /claims/recent` 全量返回 2 条，`GET /claims/recent?flight_id=X` 仅返回 1 条且 `flight_id` 字段正确
- [x] 1.4 验证：`pytest backend/tests/integration/test_claims_routes.py -v`

## 2. 后端 · hot_routes 返回真实 flight_id

- [x] 2.1 修改 `backend/flights/service.py:39-60` 的 `hot_routes`，SELECT 中加入对应 callsign 下最新 Flight.id（用 `func.max(Flight.id)` 配合 GROUP BY callsign，或 subquery 取 max created_at 的 id）；返回 dict 加 `flight_id` 字段
- [x] 2.2 修改 `backend/flights/routes.py` 的 `hot_routes` endpoint 响应模型（如有 pydantic 模型则补字段）
- [x] 2.3 在 `backend/tests/unit/test_flight_service.py` 或新建测试：seed 同 callsign 多 Flight，验证 `hot_routes` 返回的 `flight_id` 是最新那条；额外验证返回的 `flight_id` 一定能用 `service.get_flight()` 查到
- [x] 2.4 验证：`pytest backend/tests/integration/test_seed_demo.py backend/tests -k hot_routes -v`

## 3. 后端 · flights/:id 加 live_delay_minutes

- [x] 3.1 修改 `backend/flights/routes.py:44-50` 的 `FlightDetail` pydantic 模型新增 `live_delay_minutes: int | None = None`
- [x] 3.2 在 `flight_detail` endpoint 解析 `flight.last_state` JSON 取 `delay_minutes` 字段（fail-soft：解析失败或字段缺失返回 None）
- [x] 3.3 在 `backend/tests/integration` 加测试：seed 一个 Flight 带 `last_state={"delay_minutes": 12}`，验证响应 `live_delay_minutes === 12`；seed 另一个无该字段的，验证 `live_delay_minutes === None`
- [x] 3.4 验证：`pytest backend/tests -k flight_detail -v`

## 4. 前端 · 类型与 hooks 同步

- [x] 4.1 修改 `frontend/src/hooks/useClaims.ts` 的 `Claim` 类型加 `flight_id: string`
- [x] 4.2 修改 `frontend/src/hooks/useHotRoutes.ts` 的 `HotRoute` 类型加 `flight_id: string`
- [x] 4.3 新建 `frontend/src/hooks/useFlight.ts`：`useSWR<FlightDetailDto>('/flights/' + id, apiFetch)`，`FlightDetailDto` 类型含 `id/callsign/origin/destination/delay_rate/samples/live_delay_minutes`
- [x] 4.4 新建 `frontend/src/hooks/useClaimsForFlight.ts`：`useSWR<Claim[]>('/claims/recent?flight_id=' + flightId, apiFetch)`；空 flightId 不发请求
- [x] 4.5 验证 TypeScript 编译：`cd frontend && pnpm tsc --noEmit`

## 5. 前端 · 卡片可点改造 (ClaimRow)

- [x] 5.1 修改 `frontend/src/components/claims/ClaimRow.tsx`：外层包一个 `<button type="button">`，无边框背景；onClick 调 `useNavigate()` 跳 `/flight/${c.flight_id}` 并传 `state: { from: '/claims' }`
- [x] 5.2 加 hover 样式：`--surface-1 → --surface-2` + 左侧 2px `--accent-radar` 竖条；focus-visible 同样视觉
- [x] 5.3 新建 `frontend/src/tests/claim-row.test.tsx`：用 `MemoryRouter` + mock navigate，验证点击触发正确 path + state；验证 Enter/Space 触发同样导航
- [x] 5.4 验证：`cd frontend && pnpm test claim-row -- --run`

## 6. 前端 · 卡片可点改造 (HangarSlot)

- [x] 6.1 修改 `frontend/src/components/hangar/HangarSlot.tsx`：外层 `<button>` 包裹；onClick 跳 `/flight/${p.flight_id}` 传 `state: { from: '/policies' }`
- [x] 6.2 加同 5.2 的 hover/focus 样式
- [x] 6.3 新建 `frontend/src/tests/hangar-slot.test.tsx`：同 5.3 模式，验证 from: '/policies'
- [x] 6.4 验证：`cd frontend && pnpm test hangar-slot -- --run`

## 7. 前端 · 卡片可点改造 (RouteRow)

- [x] 7.1 修改 `frontend/src/components/routes/RouteRow.tsx`：外层 `<button>` 包裹；onClick 跳 `/flight/${r.flight_id}` 传 `state: { from: '/routes' }`（用后端返回的 flight_id，不再拼接 today）
- [x] 7.2 加同 5.2 的 hover/focus 样式
- [x] 7.3 新建 `frontend/src/tests/route-row.test.tsx`：验证使用后端 flight_id + from: '/routes'
- [x] 7.4 验证：`cd frontend && pnpm test route-row -- --run`

## 8. 前端 · FlightDetail 子组件 (FlightHero)

- [ ] 8.1 新建 `frontend/src/components/flight/FlightHero.tsx`：props `{ callsign, origin, destination, status }`；callsign 72px，origin→destination 用虚线箭头分隔，右侧渲染状态 chip
- [ ] 8.2 4 种状态 chip 样式：IN-FLIGHT (accent-radar) / SCHEDULED (text-secondary) / LANDED (text-tertiary) / DELAYED (warn-amber)
- [ ] 8.3 视觉规则：Hero 容器高 240px，padding 24px，font-mono

## 9. 前端 · FlightDetail 子组件 (FlightKPIBand)

- [ ] 9.1 新建 `frontend/src/components/flight/FlightKPIBand.tsx`：props `{ delayRate, samples, multiplier, liveDelayMinutes }`；4 列等分 grid
- [ ] 9.2 列定义：DELAY RATE (百分比)、SAMPLES (整数)、MULTIPLIER (`{n}×` 一位小数)、LIVE STATUS (有值显示 `+{n} min`，null 显示 `—`)
- [ ] 9.3 复用 `<KPIBand>` 的视觉 token（border / font-mono / letterSpacing）

## 10. 前端 · FlightDetail 子组件 (InsureBlock)

- [ ] 10.1 新建 `frontend/src/components/flight/InsureBlock.tsx`：props `{ flightId, delayRate, hasActivePolicy, activePolicyCount }`
- [ ] 10.2 默认渲染：复用 `PremiumPicker` + 计算 estimated payout（用 `BuyDrawer.tsx` 的 `multiplierFor` 函数，抽到 `frontend/src/components/flight/multiplier.ts` 共享）+ Confirm 按钮调 `POST /policies`
- [ ] 10.3 已有 active policy 时整体替换为提示卡："You hold {N} active polic(y|ies) on this flight · view in HANGAR →"（Link 到 `/policies`）
- [ ] 10.4 成功创建保单后刷新 `usePolicies()` 与 `useMe()`

## 11. 前端 · FlightDetail 子组件 (RelatedPolicies / RelatedClaims)

- [ ] 11.1 新建 `frontend/src/components/flight/RelatedPolicies.tsx`：props `{ flightId }`；用 `usePolicies()` + client-side filter `flight_id === flightId`；为空显示空态文案 "No policies on this flight"
- [ ] 11.2 新建 `frontend/src/components/flight/RelatedClaims.tsx`：props `{ flightId }`；用 `useClaimsForFlight(flightId)`；为空显示 "No claim yet · auto-settled when delayed ≥ 30 min"
- [ ] 11.3 两组件内部复用现有 `HangarSlot` / `ClaimRow` 渲染（注意：避免再次点击进 FlightDetail 自己造成循环 —— from 仍 push `/flight/:id`，但 navigate 同 path 是 no-op 行为）

## 12. 前端 · FlightDetail 子组件 (Breadcrumb)

- [ ] 12.1 新建 `frontend/src/components/flight/Breadcrumb.tsx`：用 `useLocation()` 读 `state?.from`
- [ ] 12.2 映射表：`/claims → CLAIMS FEED` / `/policies → MY HANGAR` / `/routes → HOT ROUTES` / 其它 → `TOWER`
- [ ] 12.3 渲染 `← {label}` 字样，点击 `navigate(targetPath)`；font-mono + text-secondary

## 13. 前端 · FlightDetail 主页面组装

- [ ] 13.1 完全重写 `frontend/src/routes/FlightDetail.tsx`：不再 `<TowerShell />`，改为独立 `<main>` 容器 maxWidth 960px
- [ ] 13.2 组装顺序：`<Breadcrumb />` → `<FlightHero />` → `<FlightKPIBand />` → `<DelayHistogram />` → `<InsureBlock />` → grid(50/50) `<RelatedPolicies /> <RelatedClaims />`
- [ ] 13.3 用 `useFlight(id)` 拉取详情数据；loading 显示 "loading..."；404 时顶部红 banner "Flight no longer tracked · ID: {id}"，下方块仍渲染（用 flight_id 查询，不依赖 flight 存在）
- [ ] 13.4 新建 `frontend/src/tests/flight-detail.test.tsx`：覆盖正常渲染 / 已有 active policy / 404 / 空态 4 种场景

## 14. 前端 · Tower 大屏点击行为修正

- [ ] 14.1 修改 `frontend/src/components/tower/GlobeMap.tsx` 或 `frontend/src/routes/TowerShell.tsx`：飞机点击不再 `navigate('/flight/:id')`，改为在大屏内本地 state 控制弹出 `<BuyDrawer flightId={...} onClose={...} />`，URL 保持 `/`
- [ ] 14.2 修改 `frontend/src/tests/tower-shell.test.tsx`：原本验证 navigate 的 case 改为验证 BuyDrawer 在大屏内挂载 + URL 不变
- [ ] 14.3 验证：`cd frontend && pnpm test tower-shell -- --run`

## 15. 整体验证

- [ ] 15.1 后端全量测试：`pytest backend/tests -v`
- [ ] 15.2 前端全量测试 + 类型检查：`cd frontend && pnpm tsc --noEmit && pnpm test -- --run`
- [ ] 15.3 本地启动 `./scripts/dev.sh` 手工冒烟：登录 → 点 Claims 一行进详情 → 面包屑回 Claims；点 Hangar 一行进详情；点 HotRoutes 一行进详情（验证 flight_id 真存在）；回到大屏点飞机弹 drawer 不离开 `/`
- [ ] 15.4 桌面 Chrome console 检查无 error/warning

## 16. OpenSpec 归档前置

- [ ] 16.1 `openspec validate card-navigation-and-flight-detail --strict --no-interactive` 全绿
- [ ] 16.2 等用户确认演示效果后，由 Claude 执行归档流程（合并 delta 到 `openspec/specs/live-dashboard/spec.md`）
