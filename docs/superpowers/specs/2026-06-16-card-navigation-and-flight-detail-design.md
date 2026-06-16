# Rialo-Captain · 卡片导航与 FlightDetail 重构 设计文档

**日期**: 2026-06-16
**作者**: Claude (设计) / Codex (实现)
**范围**: 中任务
**前置**: rialo-captain-mvp (已完成)

---

## 1. 背景与动机

当前 demo 6 页 SPA 的"页面间导航"严重欠缺：

- `ClaimRow` / `HangarSlot` / `RouteRow` 三类卡片**完全不可点**，演示时点不开任何一条详情
- `FlightDetail` 路由实现是 `<TowerShell />` + `<BuyDrawer />` 的叠加（`frontend/src/routes/FlightDetail.tsx:11-12`），从其它页面跳入会**重启 cinema 状态机、AutoSeeder 重跑、地图重挂**，体验断裂
- `HotRoutes` 的 `RouteRow` 即便加 onClick，也只能拼 `${callsign}-${今天 YYYYMMDD}` 跳转，**当天可能不存在该航班**，大概率 404
- `ClaimsFeed` 演示时遇到"这条赔付是哪个航班"问题，只能截图回答

本设计在不引入 Hub/Tab 等过度抽象的前提下，**用一次重构同时解决以上 4 个问题**，让 demo 叙事完整闭环。

## 2. 目标与非目标

### 目标

1. ClaimRow / HangarSlot / RouteRow 整行可点，跳转到对应航班的纵深视图
2. `/flight/:id` 改造为**独立的轻量静态详情页**，不再寄生于 TowerShell
3. 详情页能展示 4 类信息：基本信息、延误统计、投保入口、相关历史（自有保单 + 全局赔付）
4. Tower 大屏点飞机的**抽屉投保交互不被破坏**（cinema 不打断）
5. RouteRow 跳转必达真实存在的航班

### 非目标 (Out of Scope)

- 详情页内嵌迷你地图 / 实时轨迹（避免 GlobeMap 复用引起的 cinema 复活问题）
- 详情页 Tab 化 / Hub 化
- 大屏点飞机改为跳详情页（破坏演示叙事）
- BuyDrawer 组件本身的重构（仍保留供大屏使用）
- 移动端深度适配（保持当前 MVP 范围）

## 3. 信息架构决策

**核心决策：双轨制**

| 入口 | 行为 | 理由 |
|---|---|---|
| Tower 大屏点飞机 | 在大屏内**弹出 BuyDrawer** (URL 不变 `/`) | 大屏是演示主舞台，cinema/spotlight 上下文不可断 |
| Hangar / Claims / HotRoutes 点卡片 | `navigate('/flight/:id', { state: { from } })` 进静态详情页 | 列表入口需要"纵深查看"，独立布局空间承载更多信息 |

两种入口用途互补，不冲突。

## 4. 页面布局 · FlightDetail

```
┌─────────────────────────────────────────────────────────────────┐
│  ← [来源标签]   (面包屑, 单条)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│           UAL2351                          [ IN-FLIGHT ]         │
│        SFO  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─►  JFK                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  DELAY RATE     SAMPLES      MULTIPLIER    LIVE STATUS          │
│     32%           147          5.2 ×        +12 min              │
├─────────────────────────────────────────────────────────────────┤
│   ░░▓▓████░░░░░░  DelayHistogram (复用)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────── INSURE ──────────────────┐                     │
│  │  PREMIUM     [10] [25] [50] [100] RIA  │                     │
│  │  EST. PAYOUT IF DELAYED ≥ 30 MIN       │                     │
│  │       ≈ 52 RIA                          │                     │
│  │            [ CONFIRM · 10 RIA ]         │                     │
│  └─────────────────────────────────────────┘                     │
│  (已有 active 保单时整个块替换为提示卡)                          │
├─────────────────────────────────────────────────────────────────┤
│  YOUR POLICIES ON THIS FLIGHT  (左半)                            │
│   · HangarSlot 纵列                                              │
│  CLAIM HISTORY  (右半, 全局不限本人)                             │
│   · ClaimRow 纵列                                                │
└─────────────────────────────────────────────────────────────────┘
```

视觉规则：

- 容器最大宽度 **960px** 居中（不是 1280px，留呼吸感）
- Hero 区高度 **240px**，callsign 字号 **72px**，origin→destination 用 ATC 风格虚线箭头
- KPI Band 4 列等分，复用现有 `<KPIBand>` 视觉规范
- Insure 块用 `--surface-2` 背景 + 1px `--border-subtle` 边框，accent 用雷达青绿
- 底部 Policies / Claims 两列 grid 50/50（≥768px），更窄时堆叠
- 全局复用现有 `var(--font-mono)` / `var(--accent-radar)` 等设计 token，不引入新 token

**面包屑映射规则：**

| `location.state.from` | 显示文案 | 点击行为 |
|---|---|---|
| `'/claims'` | `← CLAIMS FEED` | `navigate('/claims')` |
| `'/policies'` | `← MY HANGAR` | `navigate('/policies')` |
| `'/routes'` | `← HOT ROUTES` | `navigate('/routes')` |
| `undefined` (直接刷新或外链) | `← TOWER` | `navigate('/')` |

## 5. 三个卡片的点击交互

| 组件文件 | 点击区域 | 行为 |
|---|---|---|
| `ClaimRow.tsx` | 整行 hit-area | `navigate('/flight/' + flight_id, { state: { from: '/claims' } })` |
| `HangarSlot.tsx` | 整行 hit-area | `navigate('/flight/' + flight_id, { state: { from: '/policies' } })` |
| `RouteRow.tsx` | 整行 hit-area | `navigate('/flight/' + flight_id, { state: { from: '/routes' } })`<br>`flight_id` 直接从后端 `/routes/hot` 取，不再前端拼接 |

实现细节：

- 外层用 `<button type="button">` 包裹，无边框背景，a11y 友好且 keyboard focusable
- hover 时 `--surface-1 → --surface-2`，左侧出现 **2px 雷达青绿竖条** 作 hover 指示
- focus-visible 状态遵循同样视觉
- Cmd/Ctrl-click 不特殊处理（SPA 默认 navigate 行为）
- `ClaimRow` 需要新增 `flight_id` 字段供导航使用（详见 §6.a）

## 6. 后端 API 改动

### 6.a `GET /claims/recent` 增加 `flight_id` 过滤参数 + 响应字段

**路由 `backend/claims/routes.py`：**

```python
@router.get("/claims/recent", response_model=list[ClaimPublic])
async def claims_recent(
    session: Annotated[AsyncSession, Depends(get_session)],
    flight_id: str | None = Query(None),   # 新增
    limit: int = Query(50, ge=1, le=200),
) -> list[ClaimPublic]:
    items = await ClaimsService(session).recent(limit=limit, flight_id=flight_id)
    ...
```

**响应模型 `ClaimPublic` 新增 `flight_id: str`** —— 前端 ClaimRow 需要它做导航。

**Service `backend/claims/service.py`** 的 `recent` 方法：可选 `flight_id` 参数，传入时 join `Policy` 过滤；同时 select Policy.flight_id 一并返回。

### 6.b `GET /routes/hot` 返回真实 `flight_id`

**Service `backend/flights/service.py:39-60`** 的 `hot_routes` 当前只返回 `callsign`。改为：每条同时返回该 callsign 下**最新 created 的 Flight 记录 id**（用子查询或 window function 都可，Codex 自选）。

响应新增字段 `flight_id: str`。前端 `useHotRoutes` 的类型同步补字段；`RouteRow` 不再 `${callsign}-${today}` 拼字符串。

### 6.c `GET /flights/:id` 响应新增 `live_delay_minutes`

**`backend/flights/routes.py:44-50` 的 `FlightDetail` 模型**新增 `live_delay_minutes: int | None`。

数据来源：从 `request.app.state.flight_cache` 查当前 callsign 的 state，按 `last_contact - scheduled_departure` 或类似规则估算；如果该航班不在 cache 或缺少必要字段，返回 `None`。

具体计算公式由 Codex 在实现时定义并补 docstring（最简单的做法是从 `Flight.last_state` JSON 取 `delay_minutes` 字段；若该字段不存在则 None）。

## 7. 前端数据流 / hooks

新增：

- `useFlight(id: string)` —— `useSWR('/flights/' + id)` 返回 `FlightDetailDto`（含 `live_delay_minutes`）
- `useClaimsForFlight(flightId: string)` —— `useSWR('/claims/recent?flight_id=' + flightId)`

调整：

- `useHotRoutes` 的 TS 类型补 `flight_id: string`
- `usePolicies()` 不动，FlightDetail 内 client-side `.filter(p => p.flight_id === flightId)` 即可（用户保单数量小，无需后端 filter）
- `useClaims` (全局赔付流) 不动

## 8. 错误与空态

| 场景 | 行为 |
|---|---|
| `GET /flights/:id` 返回 404 | 页面顶部红色 banner "Flight no longer tracked · ID: xxx"；Hero 区仅显示 ID 文本；KPI Band 全部 "—"；下方 Policies / Claims 块仍按 flight_id 查询渲染 |
| 用户在本航班无 policy | Policies 列空态："No policies on this flight" + 指向上方 Insure 块的提示 |
| 本航班无 claim | Claims 列空态："No claim yet · auto-settled when delayed ≥ 30 min" |
| 当前登录用户在本航班已有 ≥1 active policy | Insure 块整体替换为提示卡："You hold N active polic{y\|ies} on this flight · view in HANGAR →"（链接 `/policies`）。"已有"判定基于 `usePolicies()` 客户端 filter `flight_id` 且 `status === 'active'` |
| `live_delay_minutes` 为 null | LIVE STATUS 显示 "—" |
| `delay_rate` samples 为 0 | DelayHistogram 显示 "Not enough samples" 占位 |

## 9. 测试策略

### 后端 (pytest)

- `backend/tests/integration/test_claims_routes.py`
  - `GET /claims/recent?flight_id=xxx` 仅返回该航班的 claim
  - 响应每项含 `flight_id` 字段
- `backend/tests/integration/test_flights_routes.py`
  - `GET /routes/hot` 响应每项含 `flight_id` 字段，且该 id 在 DB 中存在
  - `GET /flights/:id` 响应含 `live_delay_minutes` 字段
- `backend/tests/unit/test_flight_service.py`
  - `hot_routes` 返回值含 `flight_id`，同 callsign 多 flight 时取最新

### 前端 (Vitest + RTL)

- `frontend/src/tests/flight-detail.test.tsx`
  - 渲染 Hero / KPI Band / DelayHistogram / Insure / Policies / Claims 五块
  - 用户已有 active policy 时 Insure 块替换为提示卡
  - 404 时显示 "Flight no longer tracked"，下方 Policies/Claims 仍渲染
  - 面包屑根据 `location.state.from` 显示对应来源
- `frontend/src/tests/claim-row.test.tsx`
  - 点击触发 `navigate('/flight/' + flight_id, { state: { from: '/claims' } })`
  - 键盘 Enter / Space 触发同样导航（a11y）
- `frontend/src/tests/hangar-slot.test.tsx` — 同上, `from: '/policies'`
- `frontend/src/tests/route-row.test.tsx` — 同上, `from: '/routes'`, 使用后端返回的 `flight_id`
- `frontend/src/tests/tower-shell.test.tsx`
  - 大屏点飞机仍弹 BuyDrawer，URL 保持 `/`（保护现有行为）

### Playwright E2E

可选：补一条 smoke "from Claims to FlightDetail and back"，但非阻塞。

## 10. 文件改动清单（给 Codex 的参考）

**新增：**

- `frontend/src/routes/FlightDetail.tsx` (完全重写)
- `frontend/src/components/flight/FlightHero.tsx`
- `frontend/src/components/flight/FlightKPIBand.tsx`
- `frontend/src/components/flight/InsureBlock.tsx`
- `frontend/src/components/flight/RelatedPolicies.tsx`
- `frontend/src/components/flight/RelatedClaims.tsx`
- `frontend/src/components/flight/Breadcrumb.tsx`
- `frontend/src/hooks/useFlight.ts`
- `frontend/src/hooks/useClaimsForFlight.ts`
- 对应 test 文件

**修改：**

- `frontend/src/components/claims/ClaimRow.tsx` (整行可点 + 接受 flight_id)
- `frontend/src/components/hangar/HangarSlot.tsx` (整行可点)
- `frontend/src/components/routes/RouteRow.tsx` (整行可点, 用后端 flight_id)
- `frontend/src/hooks/useClaims.ts` (Claim 类型加 flight_id)
- `frontend/src/hooks/useHotRoutes.ts` (HotRoute 类型加 flight_id)
- `backend/claims/routes.py` (加 flight_id query + 响应字段)
- `backend/claims/service.py` (recent 方法加 flight_id 参数)
- `backend/flights/routes.py` (FlightDetail 模型加 live_delay_minutes)
- `backend/flights/service.py` (hot_routes 返回 flight_id)

**保留不动：**

- `frontend/src/routes/TowerShell.tsx` (大屏继续走 BuyDrawer)
- `frontend/src/components/drawer/BuyDrawer.tsx` (供大屏使用)
- `frontend/src/components/drawer/PremiumPicker.tsx` / `DelayHistogram.tsx` (在 FlightDetail 中复用)

## 11. 工作量估算

| 阶段 | 工时 |
|---|---|
| 后端 3 处改动 + 测试 | 3-4h |
| 前端 FlightDetail 重写 + 5 个子组件 + hooks | 6-8h |
| 3 个卡片改造 + 测试 | 2h |
| Playwright smoke (可选) | 1h |
| **合计** | **1-1.5 天** |

## 12. 风险

| 风险 | 缓解 |
|---|---|
| `hot_routes` 子查询取最新 flight_id 在 SQLite 上写法别扭 | 用 `flight_id IN (SELECT max(id) FROM ...)` 等价写法；测试覆盖多 flight 同 callsign 场景 |
| 详情页内复用 PremiumPicker/DelayHistogram 与 BuyDrawer 共享样式时被新页面 break | InsureBlock 完全独立组件，PremiumPicker/DelayHistogram 只作展示组件复用，不引入新 prop |
| `location.state` 在用户直接刷新或外链进入时为 undefined | 面包屑组件检测 undefined 时只显示 "← TOWER" 兜底 |
| 已有 active policy 检测在客户端 filter，理论可被绕过下双单 | 后端 PolicyService.create_policy 已有 user+flight 唯一性约束（如无，由 Codex 在实现时补充并测试）|

## 13. 验收标准 (Clarify Gate 产物)

- [ ] ClaimRow / HangarSlot / RouteRow 整行可点，键盘可达
- [ ] `/flight/:id` 渲染不挂 TowerShell；cinema 不会因导航重启
- [ ] 详情页 6 个块（Hero/KPI/Histogram/Insure/Policies/Claims）全部按 §8 表格行为正确空态/错误态
- [ ] Tower 大屏点飞机仍弹 BuyDrawer，URL 保持 `/`
- [ ] HotRoutes 点击跳转到的航班一定存在（不出现 404）
- [ ] 所有新增 test 全绿；现有 test 不退化
- [ ] 桌面端 Chrome console 无 error 无 warning
