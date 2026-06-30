## ADDED Requirements

### Requirement: Tower Guided Demo Director 入口
系统 SHALL 在 Tower 首页提供 Guided Demo Director 入口，用于启动人工引导演示流程。启动后系统 SHALL 显示 Demo Rail，展示 `Select flight`、`Buy cover`、`Settlement replay` 三个主要步骤，并推荐一个可投影的实时航班作为候选主角。

#### Scenario: 启动人工引导演示
- **GIVEN** 用户已登录并停留在 `/` Tower 首页
- **WHEN** 用户点击 `Start guided demo`
- **THEN** 系统 SHALL 显示 Demo Rail
- **AND** Demo Rail SHALL 显示当前步骤为 `Select flight`
- **AND** 系统 SHALL 推荐并高亮一个可投影的实时航班
- **AND** 系统 SHALL NOT 调用 `POST /policies`

#### Scenario: 无可用推荐航班时安全降级
- **GIVEN** Tower 首页没有可投影的实时航班
- **WHEN** 用户点击 `Start guided demo`
- **THEN** Demo Rail SHALL 显示等待航班或数据不可用状态
- **AND** 系统 SHALL NOT 打开 BuyDrawer
- **AND** 系统 SHALL NOT 创建 policy

### Requirement: Guided Demo 人工选择与购买
系统 SHALL 允许用户在 Guided Demo 中亲自选择航班、选择保费并确认购买。系统 MUST NOT 自动替用户选择保费、确认购买或绕过 BuyDrawer 的现有购买流程。

#### Scenario: 用户选择推荐航班进入购买步骤
- **GIVEN** Guided Demo 已处于 `Select flight`
- **AND** 系统存在推荐航班 `BA178`
- **WHEN** 用户点击推荐航班或地图上的 `BA178`
- **THEN** 系统 SHALL 打开 BuyDrawer
- **AND** Demo Rail SHALL 显示当前步骤为 `Buy cover`
- **AND** BuyDrawer SHALL 仍要求用户选择保费并点击确认按钮

#### Scenario: 用户选择其它实时航班替换主角
- **GIVEN** Guided Demo 已处于 `Select flight` 或 `Buy cover`
- **WHEN** 用户点击另一架实时航班 `UA200`
- **THEN** 系统 SHALL 将本次演示主角替换为 `UA200`
- **AND** Demo Rail SHALL 显示 `UA200`
- **AND** 后续购买与回放 SHALL 使用 `UA200` 对应的 `flight_id`

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

### Requirement: Guided Demo 购买后回放状态
系统 SHALL 在用户通过 BuyDrawer 成功购买后进入 `Settlement replay` 步骤，并展示购买后闭环正在播放或已完成的可见状态。该状态 SHALL 复用现有购买后 Cinema 事件链，不得伪造新的业务 API 结果。

#### Scenario: 购买成功进入结算回放
- **GIVEN** Guided Demo 已处于 `Buy cover`
- **WHEN** BuyDrawer 通过 `POST /policies` 成功返回 created policy
- **THEN** Demo Rail SHALL 显示当前步骤为 `Settlement replay`
- **AND** Demo Rail SHALL 显示购买的航班、保费和预估或实际赔付
- **AND** Tower SHALL 路由该购买为当前 REAL protagonist
- **AND** 系统 SHALL 播放已有购买后 TrailDraw、ShockWave、ChainBeam 和 FlareLand 闭环

#### Scenario: 购买失败保留人工上下文
- **GIVEN** Guided Demo 已处于 `Buy cover`
- **WHEN** BuyDrawer 的 `POST /policies` 请求失败
- **THEN** Demo Rail SHALL 保持在 `Buy cover`
- **AND** BuyDrawer SHALL 显示现有错误状态
- **AND** 用户 SHALL 可以调整保费或退出演示

### Requirement: Guided Demo 不阻断人工地图操作
系统 SHALL 允许用户在 Guided Demo 期间拖拽、缩放、键盘操作或点击其它航班。此类人工操作 SHALL 不自动退出 Guided Demo，除非用户明确点击 `Exit demo`。

#### Scenario: 拖拽或缩放地图不退出演示
- **GIVEN** Guided Demo 正在进行
- **WHEN** 用户拖拽或缩放地图
- **THEN** Cinema SHALL 按现有规则进入 manual viewing
- **AND** Demo Rail SHALL 继续显示当前演示状态
- **AND** 当前演示航班和已购买 policy 上下文 SHALL 保留

#### Scenario: 回放期间人工操作不取消闭环
- **GIVEN** Guided Demo 已进入 `Settlement replay`
- **WHEN** 用户拖拽地图、缩放地图或点击非演示航班
- **THEN** Demo Rail SHALL 保留回放状态
- **AND** 已安排的购买后关键时刻 SHALL 继续按幂等规则播放
- **AND** 系统 SHALL NOT 重复创建同一 policy 的 visual event
