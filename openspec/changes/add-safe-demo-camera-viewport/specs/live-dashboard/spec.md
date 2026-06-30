## MODIFIED Requirements

### Requirement: Guided Demo 人工选择与购买
系统 SHALL 允许用户在 Guided Demo 中亲自选择航班、选择保费并确认购买。系统 MUST NOT 自动替用户选择保费、确认购买或绕过 BuyDrawer 的现有购买流程。Guided Demo 选择航班时，系统 SHALL 使用安全视区 camera target 聚焦该航班，避免目标被左侧 AI Briefing、右侧 Demo Rail 或底部状态栏遮挡。

#### Scenario: 用户选择推荐航班进入购买步骤
- **GIVEN** Guided Demo 已处于 `Select flight`
- **AND** 系统存在推荐航班 `BA178`
- **WHEN** 用户点击推荐航班或地图上的 `BA178`
- **THEN** 系统 SHALL 打开 BuyDrawer
- **AND** Demo Rail SHALL 显示当前步骤为 `Buy cover`
- **AND** BuyDrawer SHALL 仍要求用户选择保费并点击确认按钮
- **AND** `BA178` SHALL 被聚焦到安全视区内，而不是被浮层覆盖
- **AND** 窄屏底部 Rail 布局 SHALL 使用与桌面右侧 Rail 不同的安全视区

#### Scenario: 用户选择其它实时航班替换主角
- **GIVEN** Guided Demo 已处于 `Select flight` 或 `Buy cover`
- **WHEN** 用户点击另一架实时航班 `UA200`
- **THEN** 系统 SHALL 将本次演示主角替换为 `UA200`
- **AND** Demo Rail SHALL 显示 `UA200`
- **AND** 后续购买与回放 SHALL 使用 `UA200` 对应的 `flight_id`
- **AND** `UA200` SHALL 被聚焦到安全视区内
- **AND** 聚焦安全视区 SHALL 匹配当前 Rail 响应式布局

#### Scenario: 关闭购买抽屉暂停而不退出演示
- **GIVEN** Guided Demo 已打开 BuyDrawer 且尚未购买成功
- **WHEN** 用户关闭 BuyDrawer
- **THEN** Demo Rail SHALL 保留当前演示航班
- **AND** 当前步骤 SHALL 保持在 `Buy cover` 或显示可恢复的 paused 状态
- **AND** 用户点击 `Resume` SHALL 重新打开该航班的 BuyDrawer

#### Scenario: 用户明确退出演示
- **GIVEN** Guided Demo 正在进行
- **WHEN** 用户点击 `Exit demo`
- **THEN** 系统 SHALL 清理 Demo Rail 和本次演示主角锁定
- **AND** 系统 SHALL NOT 删除已经真实创建的 policy、claim 或 evidence
- **AND** Tower 首页 SHALL 恢复普通 Cinema 体验

#### Scenario: 旧购买回调不得污染新演示
- **GIVEN** 用户在 Guided Demo 中发起购买请求但请求尚未返回
- **AND** 用户退出该演示并重新开始新的 Guided Demo
- **WHEN** 旧购买请求延迟返回成功
- **THEN** 系统 SHALL 忽略该旧演示 session 的购买回调
- **AND** 新演示 SHALL NOT 被推进到 replay 状态
- **AND** 新演示当前打开的 BuyDrawer SHALL NOT 被旧回调关闭
