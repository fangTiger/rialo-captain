## ADDED Requirements

### Requirement: 列表与详情页提供证据入口
系统 SHALL 在 Claims Feed、My Hangar 和 Flight Detail 的赔付/保单条目上提供 Evidence 操作入口，允许用户打开 settlement-evidence timeline，同时 MUST 保留现有整行点击跳转航班详情的行为。

#### Scenario: Claims Feed 行内 Evidence 不触发航班跳转
- **GIVEN** 用户在 `/claims` 看到一条赔付记录
- **WHEN** 用户点击该行的 Evidence 操作
- **THEN** 页面 SHALL 打开 Evidence Drawer
- **AND** URL SHALL 保持 `/claims`
- **AND** 系统 SHALL NOT 跳转到 `/flight/{claim.flight_id}`

#### Scenario: Claims Feed 整行点击仍跳转航班
- **GIVEN** 用户在 `/claims` 看到一条赔付记录
- **WHEN** 用户点击该行非 Evidence 操作区域
- **THEN** 路由 SHALL 继续跳转 `/flight/{claim.flight_id}`
- **AND** `location.state.from === '/claims'`

#### Scenario: My Hangar 保单可打开 Evidence
- **GIVEN** 用户在 `/policies` 看到一张保单
- **WHEN** 用户点击该保单的 Evidence 操作
- **THEN** 页面 SHALL 打开 Evidence Drawer
- **AND** 前端 SHALL 以该 policy id 请求 timeline

#### Scenario: FlightDetail 相关区域可打开 Evidence
- **GIVEN** 用户在 `/flight/:id` 查看 Related Policies 或 Related Claims
- **WHEN** 用户点击任一相关条目的 Evidence 操作
- **THEN** 页面 SHALL 打开 Evidence Drawer
- **AND** Drawer 关闭后 SHALL 留在当前 FlightDetail 页面

### Requirement: Evidence Drawer UI 状态
系统 SHALL 使用现有暗色设计 token 渲染 Evidence Drawer，并支持 loading、success、empty、error、close 五种状态。Drawer MUST 可键盘关闭，且不得遮断底层路由状态。

#### Scenario: 加载状态
- **GIVEN** Evidence Drawer 已打开且 timeline 请求尚未完成
- **WHEN** 组件渲染
- **THEN** Drawer SHALL 显示加载状态

#### Scenario: 成功状态
- **GIVEN** timeline API 返回多条事件
- **WHEN** Drawer 渲染
- **THEN** Drawer SHALL 按时间顺序展示事件
- **AND** 每条事件 SHALL 显示标题、source、格式化时间和 payload 摘要

#### Scenario: Esc 关闭 Drawer
- **GIVEN** Evidence Drawer 已打开
- **WHEN** 用户按下 `Escape`
- **THEN** Drawer SHALL 关闭
- **AND** 当前路由 SHALL 保持不变

#### Scenario: 错误状态不破坏页面
- **GIVEN** timeline 请求失败
- **WHEN** Drawer 渲染错误状态
- **THEN** 用户 SHALL 仍可关闭 Drawer
- **AND** 页面现有列表、面包屑和导航 SHALL 保持可用
