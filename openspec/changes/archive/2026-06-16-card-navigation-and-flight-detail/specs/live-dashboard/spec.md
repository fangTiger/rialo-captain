## ADDED Requirements

### Requirement: SPA 路由架构与详情页导航行为

系统 SHALL 提供 6 个路由（`/` `/flight/:id` `/policies` `/claims` `/routes` `/rialo-inside`），桌面端 1280px+ 全部可达，浏览器 console 无 error、无 warning；`/flight/:id` SHALL 渲染为独立静态详情页，不挂载 `<TowerShell />`；大屏点击飞机 SHALL 在大屏内本地弹出 BuyDrawer 而不触发路由跳转；列表页点击卡片 SHALL 跳转到 FlightDetail 并携带来源信息。

#### Scenario: 直接访问受保护路由
- **GIVEN** 用户直接打开 `/policies` 但未登录
- **WHEN** 页面挂载
- **THEN** 路由守卫跳转 `/login`，登录后回跳 `/policies`

#### Scenario: 大屏点击飞机弹出 BuyDrawer 不离开大屏
- **GIVEN** 用户在 `/` 大屏上
- **WHEN** 用户点击一个飞机光点
- **THEN** URL 保持 `/`，不触发 `navigate('/flight/:id')`
- **AND** BuyDrawer 以 slide-up 形式从底部弹出，覆盖在大屏之上
- **AND** cinema 状态机继续运行，AutoSeeder 不被重启
- **AND** 关闭 drawer 后大屏交互无副作用

#### Scenario: 列表卡片跳转独立 FlightDetail 页
- **GIVEN** 用户在 `/claims`、`/policies` 或 `/routes` 列表页
- **WHEN** 用户点击任意一行卡片
- **THEN** 路由跳转 `/flight/:id`
- **AND** 跳转携带 `location.state.from` 指向来源路径
- **AND** FlightDetail 页面独立渲染，不挂载 `<TowerShell />`
- **AND** cinema 状态机不在 FlightDetail 页激活

#### Scenario: Rialo Inside 滚动驱动动画
- **GIVEN** 用户访问 `/rialo-inside`
- **WHEN** 向下滚动
- **THEN** "传统多角色架构 vs Rialo 单合约架构" 对比动画按 5 个分段触发，每段 viewport 占比 100vh



### Requirement: 列表卡片整行可点导航

系统 SHALL 让 `ClaimRow`、`HangarSlot`、`RouteRow` 三类列表卡片整行成为可点击 hit-area，跳转到对应航班的 FlightDetail 页，并保留来源信息用于面包屑回跳。

#### Scenario: ClaimRow 点击跳转
- **GIVEN** 用户在 `/claims` 看到一条赔付记录
- **WHEN** 用户点击该行任意位置
- **THEN** 路由跳转 `/flight/{claim.flight_id}`
- **AND** `location.state.from === '/claims'`

#### Scenario: HangarSlot 点击跳转
- **GIVEN** 用户在 `/policies` 看到一张保单
- **WHEN** 用户点击该卡片任意位置
- **THEN** 路由跳转 `/flight/{policy.flight_id}`
- **AND** `location.state.from === '/policies'`

#### Scenario: RouteRow 点击跳转使用后端 flight_id
- **GIVEN** 用户在 `/routes` 看到一条热门航线
- **WHEN** 用户点击该行
- **THEN** 路由跳转 `/flight/{route.flight_id}`，`flight_id` 取自后端 `/routes/hot` 响应字段
- **AND** `location.state.from === '/routes'`
- **AND** 跳转目标在 DB 中一定存在（不出现 404）

#### Scenario: 卡片键盘可达
- **GIVEN** 任意可点卡片获得键盘焦点
- **WHEN** 用户按下 Enter 或 Space
- **THEN** 触发与点击相同的导航行为
- **AND** 卡片显示 focus-visible 视觉状态

### Requirement: FlightDetail 静态详情页

系统 SHALL 在 `/flight/:id` 渲染独立的静态详情页，包含 6 个内容块（Hero / KPI Band / DelayHistogram / Insure / Related Policies / Related Claims），不复用 `<TowerShell />` 或 `<GlobeMap />`。

#### Scenario: 基础渲染
- **GIVEN** 用户从列表页跳入 `/flight/:id`，flight 在 DB 中存在
- **WHEN** 页面挂载完成
- **THEN** 渲染 Hero 区（callsign 72px + origin→destination + 状态 chip）
- **AND** 渲染 KPI Band 4 列（delay_rate / samples / multiplier / live_delay_minutes）
- **AND** 渲染 DelayHistogram
- **AND** 渲染 Insure 块（PremiumPicker + Confirm 按钮）
- **AND** 渲染 Related Policies 列（当前用户在本航班的 policies）
- **AND** 渲染 Related Claims 列（本航班全局 claims）

#### Scenario: 当前用户已有 active policy 时禁用 Insure
- **GIVEN** 当前登录用户在本航班存在至少 1 条 `status === 'active'` 的 policy
- **WHEN** FlightDetail 渲染 Insure 块
- **THEN** Insure 块整体替换为提示卡："You hold N active polic(y|ies) on this flight · view in HANGAR →"
- **AND** 提示卡的链接跳转 `/policies`

#### Scenario: flight 404 时降级显示
- **GIVEN** 路由参数 `:id` 在后端 `GET /flights/:id` 返回 404
- **WHEN** 页面渲染
- **THEN** 顶部显示红色 banner "Flight no longer tracked · ID: {id}"
- **AND** Hero 区仅显示 ID 文本，KPI Band 4 列全部显示 "—"
- **AND** Related Policies / Related Claims 块仍按 flight_id 查询渲染

#### Scenario: live_delay_minutes 为 null 时占位
- **GIVEN** 后端响应 `live_delay_minutes === null`
- **WHEN** KPI Band 渲染 LIVE STATUS 列
- **THEN** 显示 "—"

#### Scenario: 本航班无 claim 空态
- **GIVEN** `GET /claims/recent?flight_id={id}` 返回空数组
- **WHEN** Related Claims 列渲染
- **THEN** 显示空态文案 "No claim yet · auto-settled when delayed ≥ 30 min"

#### Scenario: 当前用户在本航班无 policy 空态
- **GIVEN** 当前用户 policies 经 client-side filter 后为空
- **WHEN** Related Policies 列渲染
- **THEN** 显示空态文案 "No policies on this flight" + 引导上方 Insure 块

### Requirement: 面包屑组件 location.state.from 映射

系统 SHALL 在 FlightDetail 顶部渲染面包屑组件，根据 `location.state.from` 显示对应来源标签并支持点击回跳。

#### Scenario: from 为 /claims
- **GIVEN** `location.state.from === '/claims'`
- **WHEN** 面包屑渲染
- **THEN** 显示 `← CLAIMS FEED`，点击导航至 `/claims`

#### Scenario: from 为 /policies
- **GIVEN** `location.state.from === '/policies'`
- **WHEN** 面包屑渲染
- **THEN** 显示 `← MY HANGAR`，点击导航至 `/policies`

#### Scenario: from 为 /routes
- **GIVEN** `location.state.from === '/routes'`
- **WHEN** 面包屑渲染
- **THEN** 显示 `← HOT ROUTES`，点击导航至 `/routes`

#### Scenario: from 为 undefined (直接刷新或外链)
- **GIVEN** `location.state.from` 为 undefined 或不在映射表内
- **WHEN** 面包屑渲染
- **THEN** 显示 `← TOWER`，点击导航至 `/`

### Requirement: ClaimsService.recent 支持 flight_id 过滤

后端 `GET /claims/recent` SHALL 支持可选 query 参数 `flight_id`，并在响应 `ClaimPublic` 中包含 `flight_id` 字段。

#### Scenario: 不传 flight_id 时全局返回
- **GIVEN** 调用 `GET /claims/recent?limit=50`
- **WHEN** 后端处理请求
- **THEN** 返回全局最近 50 条 claim，每条含 `flight_id` 字段

#### Scenario: 传 flight_id 时仅返回该航班 claim
- **GIVEN** 调用 `GET /claims/recent?flight_id=FOO-20260616`
- **WHEN** 后端处理请求
- **THEN** 仅返回 `flight_id === 'FOO-20260616'` 的 claim
- **AND** 响应每项 `flight_id` 字段等于传入值

### Requirement: hot_routes 响应包含真实 flight_id

后端 `GET /routes/hot` SHALL 在响应每项中包含真实存在的 `flight_id`（取该 callsign 下最新 created 的 Flight.id）。

#### Scenario: 同 callsign 多 Flight 时取最新
- **GIVEN** DB 中 callsign `UAL2351` 存在多条 Flight 记录
- **WHEN** 调用 `GET /routes/hot`
- **THEN** 该 callsign 对应项的 `flight_id` 等于 created_at 最大的 Flight.id

#### Scenario: flight_id 必在 DB 中存在
- **GIVEN** 任意 hot_routes 响应
- **WHEN** 调用 `GET /flights/{flight_id}` 验证
- **THEN** 返回 200，不出现 404

### Requirement: flights/:id 响应包含 live_delay_minutes

后端 `GET /flights/:id` 响应模型 SHALL 包含 `live_delay_minutes: int | None` 字段，表示该航班当前观测延误分钟数；无法计算时为 null。

#### Scenario: 有 last_state delay 数据
- **GIVEN** Flight 记录 `last_state` JSON 含可解析的延误数据
- **WHEN** 调用 `GET /flights/:id`
- **THEN** 响应 `live_delay_minutes` 为整数分钟值

#### Scenario: 无可用数据时为 null
- **GIVEN** Flight `last_state` 为空或缺少延误字段
- **WHEN** 调用 `GET /flights/:id`
- **THEN** 响应 `live_delay_minutes === null`
