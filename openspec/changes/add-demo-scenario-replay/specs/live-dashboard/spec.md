## MODIFIED Requirements

### Requirement: Tower Guided Demo Director 入口
系统 SHALL 在 Tower 首页提供 Guided Demo Director 入口，用于启动人工引导演示流程。启动后系统 SHALL 显示 Guided rail，展示 `Select flight`、`Buy cover`、`Settlement replay` 三个主要步骤，并推荐一个可投影的实时航班作为候选主角。系统 SHALL 额外提供 scenario picker，允许操作者选择不同演示场景并查看场景目标、推荐动作和当前状态。

#### Scenario: 启动人工引导演示
- **GIVEN** 用户已登录并停留在 `/` Tower 首页
- **WHEN** 用户点击 `Start guide`
- **THEN** 系统 SHALL 显示 Guided rail
- **AND** Guided rail SHALL 显示当前步骤为 `Select flight`
- **AND** 系统 SHALL 推荐并高亮一个可投影的实时航班
- **AND** 系统 SHALL NOT 调用 `POST /policies`

#### Scenario: 选择演示场景
- **GIVEN** Guided rail 已显示
- **WHEN** 用户选择 `Smooth payout`、`At risk flight` 或 `Evidence deep dive` 场景
- **THEN** Guided rail SHALL 显示所选场景名称
- **AND** Guided rail SHALL 显示该场景的目标说明和下一步动作
- **AND** 系统 SHALL NOT 创建 policy、claim 或 evidence
- **AND** 系统 SHALL NOT 调用任何真实结算或真实支付能力

#### Scenario: 无可用推荐航班时安全降级
- **GIVEN** Tower 首页没有可投影的实时航班
- **WHEN** 用户点击 `Start guide`
- **THEN** Guided rail SHALL 显示等待航班或数据不可用状态
- **AND** 系统 SHALL NOT 打开 BuyDrawer
- **AND** 系统 SHALL NOT 创建 policy

### Requirement: Guided Demo 购买后回放状态
系统 SHALL 在用户通过 BuyDrawer 成功购买后进入 `Settlement replay` 步骤，并展示购买后闭环正在播放、可重放或已完成的可见状态。该状态 SHALL 复用现有购买后 Cinema 事件链，不得伪造新的业务 API 结果。

#### Scenario: 购买成功进入结算回放
- **GIVEN** Guided Demo 已处于 `Buy cover`
- **WHEN** BuyDrawer 通过 `POST /policies` 成功返回 created policy
- **THEN** Guided rail SHALL 显示当前步骤为 `Settlement replay`
- **AND** Guided rail SHALL 显示购买的航班、保费和预估或实际赔付
- **AND** Tower SHALL 路由该购买为当前 REAL protagonist
- **AND** Tower SHALL 在购买完成后的 2-5 秒窗口内明显呈现购买闭环关键视觉
- **AND** Tower SHALL 在约 2 秒启动购买后的 TrailDraw，并保持约 3 秒可见时长
- **AND** 系统 SHALL 在约 3 秒、4 秒、5 秒依次播放 ShockWave、ChainBeam 和 FlareLand 闭环

#### Scenario: 用户重放结算闭环
- **GIVEN** Guided Demo 已进入 `Settlement replay`
- **AND** 当前 demo policy 已完成或正在播放结算视觉链路
- **WHEN** 用户点击 `Replay settlement`
- **THEN** 系统 SHALL 重新播放该 policy 的 demo visual timeline
- **AND** Guided rail SHALL 显示 replay 正在播放或 replay 计数
- **AND** 系统 SHALL NOT 再次调用 `POST /policies`
- **AND** 系统 SHALL NOT 修改用户余额、policy 状态或 claim 记录

#### Scenario: 用户打开证据故事
- **GIVEN** Guided Demo 已进入 `Settlement replay`
- **AND** 当前 demo policy 或 claim 有 evidence subject
- **WHEN** 用户点击 `Open evidence story`
- **THEN** Evidence Drawer SHALL 打开对应 subject
- **AND** Drawer SHALL 使用持久化 timeline API 数据
- **AND** Guided rail SHALL 保留当前 replay 状态

#### Scenario: 购买失败保留人工上下文
- **GIVEN** Guided Demo 已处于 `Buy cover`
- **WHEN** BuyDrawer 的 `POST /policies` 请求失败
- **THEN** Guided rail SHALL 保持在 `Buy cover`
- **AND** BuyDrawer SHALL 显示现有错误状态
- **AND** 用户 SHALL 可以调整保费或退出演示

### Requirement: Demo-only Copilot Prompts
系统 SHALL 在 demo 相关 UI 中提供只读 Copilot prompt chips，用于解释当前场景、购买结果或证据链。Copilot prompt MUST NOT 执行买险、触发赔付、修改余额或改变 replay 状态。

#### Scenario: 场景 prompt 只触发问答
- **GIVEN** Guided Demo Rail 已显示所选场景
- **WHEN** 用户点击 demo prompt chip
- **THEN** 前端 SHALL 调用 Copilot ask
- **AND** 请求 subject SHALL 使用当前页面或 demo 上下文
- **AND** 系统 SHALL NOT 创建 policy、claim 或 evidence

#### Scenario: 证据 prompt 只解释 timeline
- **GIVEN** Evidence Drawer 正在显示 demo evidence story
- **WHEN** 用户点击 `Explain this evidence chain`
- **THEN** Copilot SHALL 只解释当前 evidence subject
- **AND** Copilot SHALL NOT 修改保单、赔付或余额
