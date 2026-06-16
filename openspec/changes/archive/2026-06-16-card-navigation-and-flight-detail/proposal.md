# Change: card-navigation-and-flight-detail

## Why

Demo 当前 6 页 SPA 的"页面间导航"严重欠缺:

- `ClaimRow` / `HangarSlot` / `RouteRow` 三类卡片完全不可点
- `/flight/:id` 实现是 `<TowerShell />` + `<BuyDrawer />` 叠加 (`frontend/src/routes/FlightDetail.tsx:11-12`), 从其它页面跳入会重启 cinema 状态机, 体验断裂
- `HotRoutes` 的 `RouteRow` 即便加 onClick, 用 `${callsign}-${今天}` 拼 flight_id 会大概率 404
- ClaimsFeed 演示时遇到"这条赔付是哪个航班"问题, 只能截图回答

本提案在不引入 Hub/Tab 等过度抽象的前提下, 一次重构同时解决以上 4 个问题, 让 demo 叙事完整闭环.

完整设计文档见 `docs/superpowers/specs/2026-06-16-card-navigation-and-flight-detail-design.md` (commit `2de6c59`).

## What Changes

- **MODIFIED** `/flight/:id` 路由实现: 从"复用 TowerShell + 底部抽屉"改为"独立静态详情页"
- **ADDED** FlightDetail 6 个内容块: Hero / KPI Band / DelayHistogram / Insure (inline) / Related Policies / Related Claims
- **ADDED** ClaimRow / HangarSlot / RouteRow 整行可点跳转 `/flight/:id`, 含面包屑 location.state.from
- **ADDED** 面包屑组件 + 4 种 from 映射 (`/claims` → CLAIMS FEED, `/policies` → MY HANGAR, `/routes` → HOT ROUTES, undefined → TOWER)
- **MODIFIED** Tower 大屏点飞机交互: 不再触发 navigate, 改为直接在 `/` 上弹 BuyDrawer (保护 cinema 不打断)
- **ADDED** `GET /claims/recent?flight_id=xxx` 过滤参数; `ClaimPublic` 响应模型新增 `flight_id` 字段
- **MODIFIED** `GET /routes/hot` 响应每项新增真实 `flight_id` 字段 (取该 callsign 下最新 Flight.id)
- **MODIFIED** `GET /flights/:id` 响应模型新增 `live_delay_minutes: int | None` 字段
- **ADDED** 新前端 hooks: `useFlight(id)` / `useClaimsForFlight(flightId)`

## Impact

- Affected specs:
  - `live-dashboard` (MODIFIED Flight Detail 呈现; ADDED 列表卡片导航; ADDED FlightDetail 内容块)
- Affected code:
  - `backend/claims/routes.py`, `backend/claims/service.py`
  - `backend/flights/routes.py`, `backend/flights/service.py`
  - `frontend/src/routes/FlightDetail.tsx` (完全重写)
  - `frontend/src/components/flight/*` (新增 5 个子组件)
  - `frontend/src/components/claims/ClaimRow.tsx`
  - `frontend/src/components/hangar/HangarSlot.tsx`
  - `frontend/src/components/routes/RouteRow.tsx`
  - `frontend/src/components/tower/GlobeMap.tsx` (大屏点飞机不再 navigate)
  - `frontend/src/hooks/useFlight.ts` (新增), `useClaimsForFlight.ts` (新增)
  - `frontend/src/hooks/useClaims.ts`, `useHotRoutes.ts` (类型补字段)
  - 对应 test 文件

## Acceptance Criteria (Clarify Gate 产物)

- ClaimRow / HangarSlot / RouteRow 整行可点, 键盘 Enter/Space 可达
- `/flight/:id` 渲染不挂 TowerShell; cinema 不因导航重启
- FlightDetail 6 个块全部按设计文档 §8 表格行为正确空态/错误态
- Tower 大屏点飞机仍弹 BuyDrawer, URL 保持 `/`
- HotRoutes 卡片点击跳转到的航班一定存在 (不出现 404)
- 所有新增 test 全绿; 现有 test 不退化
- 桌面端 Chrome console 无 error 无 warning

## Out of Scope

- 详情页内嵌迷你地图 / 实时轨迹 (避免 GlobeMap 复用引起 cinema 复活)
- 详情页 Tab 化 / Hub 化
- 大屏点飞机改为跳详情页 (破坏演示叙事)
- BuyDrawer 组件本身的重构 (保留供大屏使用)
- 移动端深度适配 (保持当前 MVP 范围)
- 全局搜索框 (P0-1, 单独立项)

## Risks

| 风险 | 缓解 |
|---|---|
| `hot_routes` 子查询取最新 flight_id 在 SQLite 上写法别扭 | 用 `flight_id IN (SELECT max(id) FROM ...)` 等价写法; 测试覆盖多 flight 同 callsign 场景 |
| 详情页内复用 PremiumPicker/DelayHistogram 与 BuyDrawer 共享样式时被新页面 break | InsureBlock 完全独立组件, PremiumPicker/DelayHistogram 只作展示组件复用, 不引入新 prop |
| `location.state` 在用户直接刷新或外链进入时为 undefined | 面包屑组件检测 undefined 时只显示 `← TOWER` 兜底 |
| 已有 active policy 检测在客户端 filter 理论可被绕过 | 后端 `PolicyService.create_policy` 已有 user+flight 唯一性约束 (如无, 由实现者补充并测试) |
