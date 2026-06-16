## ADDED Requirements

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
