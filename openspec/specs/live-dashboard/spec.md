# live-dashboard Specification

## Purpose
TBD - created by archiving change card-navigation-and-flight-detail. Update Purpose after archive.
## Requirements
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

### Requirement: WebSocket 实时事件总线

系统 SHALL 通过 `WS /ws` 广播三类事件：`state_update` / `FLARE` / `toast`，所有大屏组件 SHALL 订阅同一连接。

#### Scenario: 连接建立携带鉴权
- **GIVEN** 用户已登录、浏览器持有 JWT cookie
- **WHEN** 前端连接 `/ws`
- **THEN** 服务端校验 cookie、加入广播组、发送 `{type: "hello", server_time}` 帧

#### Scenario: 断线指数退避重连
- **GIVEN** WS 连接因网络断开
- **WHEN** 客户端检测到 close
- **THEN** 按 1s → 2s → 4s → ... → 30s 上限退避重连；底部 LED 显示重连中（黄色）

#### Scenario: state_update 节流广播
- **GIVEN** 后端航班 state 高频更新
- **WHEN** 广播给前端
- **THEN** 同一 flight_id 的 state_update 最少 1 秒一次（避免淹没大屏）

### Requirement: 全局搜索快捷键触发

系统 SHALL 在除 `/login` 之外的所有路由全局监听 `/`、`Cmd+K` (Mac)、`Ctrl+K` (Win) 三个快捷键，触发时弹出全屏覆盖的搜索面板 modal。

#### Scenario: 在 Tower 大屏按 / 弹出
- **GIVEN** 用户在 `/` 页面，焦点不在任何 INPUT/TEXTAREA 元素上
- **WHEN** 用户按下 `/`
- **THEN** SearchPalette modal 弹出，输入框自动获焦，背景 cinema 继续运行但被半透明遮罩覆盖

#### Scenario: 在任意非 login 页按 Cmd+K 弹出
- **GIVEN** 用户在 `/claims`、`/policies`、`/routes`、`/flight/:id`、`/rialo-inside` 任一页面
- **WHEN** 用户按下 `Cmd+K` (Mac) 或 `Ctrl+K` (Win)
- **THEN** SearchPalette modal 弹出，输入框获焦
- **AND** `e.preventDefault()` 被调用，浏览器默认行为不触发

#### Scenario: 输入框已聚焦时按 / 作字面输入
- **GIVEN** 用户焦点在某个 INPUT 或 TEXTAREA 元素中（如 BuyDrawer 的 premium 输入）
- **WHEN** 用户按下 `/`
- **THEN** SearchPalette **不**弹出
- **AND** `/` 字符作为字面输入进入当前输入框

#### Scenario: 在 /login 页 hotkey 不挂载
- **GIVEN** 用户在 `/login` 页面
- **WHEN** 用户按下 `/` 或 `Cmd+K`
- **THEN** 不弹出任何 modal
- **AND** TopNav 也未渲染（未登录状态），无 PRESS / hint

#### Scenario: 按 Esc 关闭面板
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户按下 `Escape`
- **THEN** modal 关闭，输入框清空
- **AND** 焦点返回触发前的元素

#### Scenario: 点击 overlay 关闭面板
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户点击 modal 边界外的半透明遮罩区域
- **THEN** modal 关闭，行为同 Esc

### Requirement: 搜索面板渲染与匹配

系统 SHALL 在 SearchPalette modal 中实时按 callsign / origin 机场代码 / destination 机场代码做大小写不敏感子串匹配，按 callsign 字母升序排列，截取前 10 条显示。

#### Scenario: 输入 callsign 子串命中
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户输入 `UAL`
- **THEN** 结果列表显示所有 callsign 包含 `UAL` 的航班，按字母升序
- **AND** 大小写不敏感（输入 `ual` 与 `UAL` 结果相同）

#### Scenario: 输入机场代码命中
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户输入 `SFO`
- **THEN** 结果列表显示所有 origin 或 destination 为 SFO 的航班

#### Scenario: 输入 origin→destination 组合命中
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户输入 `SFO->JFK` 或 `SFO→JFK`
- **THEN** 结果列表显示 origin === SFO 且 destination === JFK 的航班

#### Scenario: 结果超过 10 时显示溢出提示
- **GIVEN** 用户输入命中 18 条航班
- **WHEN** 结果列表渲染
- **THEN** 仅显示前 10 条按 callsign 字母升序
- **AND** 列表底部显示 `+8 more · refine your query`

#### Scenario: 空输入显示 hint
- **GIVEN** SearchPalette 已打开
- **WHEN** 输入框为空
- **THEN** 结果区显示 hint `Type a callsign or airport code · e.g. SFO, JFK, UAL2351`
- **AND** 不渲染任何结果行

#### Scenario: 无匹配显示 no-match
- **GIVEN** SearchPalette 已打开
- **WHEN** 用户输入 `XYZ999` 且无航班匹配
- **THEN** 结果区显示 `No flight matches "XYZ999"`

#### Scenario: origin/destination 为 null 的航班按 callsign 仍可命中
- **GIVEN** 一架航班 callsign === `OPS001`、origin === null、destination === null
- **WHEN** 用户输入 `OPS`
- **THEN** 该航班出现在结果列表
- **AND** 该行 route 列显示 `—` 占位

### Requirement: 搜索面板键盘与鼠标交互

系统 SHALL 支持 ↑↓ 键导航、Enter 跳转、首行自动选中、鼠标 hover 同步选中态。

#### Scenario: 首行自动选中
- **GIVEN** SearchPalette 已打开，用户输入 `UAL` 命中至少 1 条
- **WHEN** 结果列表渲染完成
- **THEN** `selectedIndex === 0`（首行选中）
- **AND** 用户直接按 Enter 即跳转首条结果

#### Scenario: ↑↓ 改变 selectedIndex
- **GIVEN** 当前 `selectedIndex === 0`，结果列表有 5 条
- **WHEN** 用户按下 `↓`
- **THEN** `selectedIndex === 1`
- **AND** 第 2 行显示选中视觉

#### Scenario: 鼠标 hover 同步 selectedIndex
- **GIVEN** 当前 `selectedIndex === 0`
- **WHEN** 用户鼠标移入第 3 行
- **THEN** `selectedIndex === 2`
- **AND** 第 3 行显示选中视觉
- **AND** 之后按 `↓` 移动到第 4 行（从鼠标位置继续）

#### Scenario: Enter 触发跳转
- **GIVEN** `selectedIndex === 2`，对应航班 id `UAL2351-20260616`
- **WHEN** 用户按下 `Enter`
- **THEN** 触发 `navigate('/flight/UAL2351-20260616', { state: { from: location.pathname } })`
- **AND** SearchPalette 关闭

#### Scenario: 鼠标点击触发跳转
- **GIVEN** SearchPalette 已打开，结果列表渲染中
- **WHEN** 用户鼠标点击某一行
- **THEN** 触发与 Enter 等价的 navigate 行为
- **AND** SearchPalette 关闭

#### Scenario: 跳转携带来源 pathname
- **GIVEN** 用户从 `/policies` 页面打开 SearchPalette 并选中一条结果
- **WHEN** 用户触发 Enter
- **THEN** navigate 的 `state.from === '/policies'`
- **AND** FlightDetail 页面的面包屑显示 `← MY HANGAR`

### Requirement: TopNav 全局搜索 hint

系统 SHALL 在 TopNav 右侧 `BAL · email` 之前永久显示 `PRESS /` hint，提示用户搜索快捷键存在。

#### Scenario: 已登录用户看到 hint
- **GIVEN** 用户已登录，TopNav 渲染
- **WHEN** 页面挂载
- **THEN** TopNav 右侧显示 `PRESS /` 灰色小字（`--text-tertiary` 颜色，font-mono 11px）
- **AND** hint 位于 `BAL` 标签之前

#### Scenario: 未登录用户无 hint
- **GIVEN** 用户在 `/login` 页面
- **WHEN** 页面挂载
- **THEN** TopNav 整体不渲染，自然无 hint

### Requirement: /flights/live 响应包含 origin 与 destination

后端 `GET /flights/live` 响应 `FlightPublic` 模型 SHALL 包含 `origin: str | None` 与 `destination: str | None` 字段；数据来自 `Flight` 表按 callsign join。

#### Scenario: 已知 callsign 包含机场代码
- **GIVEN** DB 中存在 Flight 记录 `callsign === 'UAL2351'`、`origin === 'SFO'`、`destination === 'JFK'`
- **AND** cache 中也存在该 callsign 的 live state
- **WHEN** 调用 `GET /flights/live`
- **THEN** 响应中对应项的 `origin === 'SFO'` 且 `destination === 'JFK'`

#### Scenario: 未知 callsign 字段为 null
- **GIVEN** cache 中存在某 callsign 的 live state，但 DB Flight 表无对应记录
- **WHEN** 调用 `GET /flights/live`
- **THEN** 响应中对应项的 `origin === null` 且 `destination === null`

#### Scenario: 响应无 N+1 query
- **GIVEN** cache 中有 300 条 live state
- **WHEN** 调用 `GET /flights/live`
- **THEN** 整个 handler 执行期间 Flight 表的 SQL 查询次数 ≤ 1（一次性 batch 取所有 callsign）
- **AND** 响应总耗时不显著大于改动前

