## MODIFIED Requirements

### Requirement: claim.triggered 后端事件
系统 SHALL 在 ClaimEngine 判断保单延误条件命中时广播 `claim.triggered`，供 Cinema C2 ShockWave 使用，并保持后续 `claim.settled`、`flight.landed`、`flare` payload 兼容；当 delay 由 inject-delay 写入时，后端 SHALL 支持按目标航班立即检测。

#### Scenario: 条件命中后广播 claim.triggered
- **GIVEN** ACTIVE policy 的 delay condition 被观测值命中
- **WHEN** ClaimEngine 处理该 policy
- **THEN** 系统 SHALL 在触发 settlement 前广播 `claim.triggered`
- **AND** payload SHALL 至少包含 `flight_id`、`policy_id`、`delay_minutes`、`source`
- **AND** payload SHOULD 包含 `airport_iata` 或可投影经纬度

#### Scenario: inject-delay 立即触发目标航班扫描
- **GIVEN** `/inject-delay` 或 `/admin/inject-delay` 写入某个 flight 的 delay override
- **WHEN** 该 flight 存在一个或多个 ACTIVE policy
- **THEN** 后端 SHALL 在 endpoint 返回前运行 `ClaimEngine.run_for_flight(flight_id)`
- **AND** `run_for_flight` SHALL 只处理该 flight 的 ACTIVE policy
- **AND** 命中条件的 policy SHALL 依次广播 `claim.triggered`、`claim.settled`、`flight.landed`

#### Scenario: run_for_flight 不扫描其他航班
- **GIVEN** 数据库中存在 flight A 和 flight B 的 ACTIVE policy
- **WHEN** 系统调用 `ClaimEngine.run_for_flight(flight A)`
- **THEN** ClaimEngine SHALL NOT trigger flight B 的 policy
- **AND** flight B 的后续检测 SHALL 仍由其自己的 inject-delay 或 30 秒后台 `run_once()` 处理

#### Scenario: 未命中条件不广播 claim.triggered
- **GIVEN** ACTIVE policy 的 delay condition 阈值为 30 分钟
- **WHEN** ClaimEngine 观测到 delay 小于 30 分钟
- **THEN** 系统 SHALL NOT 广播 `claim.triggered`
- **AND** 系统 SHALL NOT 创建 ChainBeam 或 FlareLand 相关事件

#### Scenario: settled 与 landed payload 不新增字段
- **GIVEN** C2 使用 C1 已扩展的 `claim.settled` 与 `flight.landed`
- **WHEN** C2 change 生效
- **THEN** 后端 SHALL NOT 为 C2 新增额外必填字段
- **AND** 前端 SHALL 兼容 C1 payload shape

### Requirement: STORY 时间窗释放关键时刻
系统 SHALL 把提前到达的 C2 事件排到当前主角压缩 STORY 关键窗口播放，以匹配现场 demo 约 8 秒完成闭环的节奏。

#### Scenario: claim.triggered 在 5 秒窗口触发 ShockWave
- **GIVEN** 当前主角的 `claim.triggered` 事件已进入 key moment queue
- **WHEN** cycle elapsed 为 4999ms
- **THEN** 系统 SHALL NOT 渲染 ShockWave
- **WHEN** cycle elapsed 到达 5000ms
- **THEN** 系统 SHALL 渲染 ShockWave
- **AND** ShockWave SHALL 以该事件的机场或 fallback 坐标为中心

#### Scenario: claim.settled 在 ShockWave 后触发 ChainBeam
- **GIVEN** 当前主角的 `claim.settled` 事件已进入 key moment queue
- **WHEN** ShockWave 已启动约 1 秒
- **THEN** 系统 SHALL 渲染 ChainBeam
- **AND** ChainBeam SHALL 展示 `claim.settled` payload 中的 mock `tx_hash`

#### Scenario: flight.landed 在 ChainBeam 后触发 FlareLand
- **GIVEN** 当前主角的 `flight.landed` 事件已进入 key moment queue
- **WHEN** ChainBeam 已启动约 2 秒或 landed 事件在压缩 STORY 窗口后到达
- **THEN** 系统 SHALL 渲染 FlareLand
- **AND** FlareLand SHALL 以当前主角航班位置或 event payload 坐标为中心

#### Scenario: 无 trigger 的 settled 仍可播放 ChainBeam
- **GIVEN** 当前主角缺少对应 `claim.triggered` 事件
- **WHEN** cycle elapsed 已达到 5000ms 且 `claim.settled` 到达
- **THEN** 系统 SHALL 渲染 ChainBeam
- **AND** 系统 SHALL NOT 因缺少 ShockWave 阻塞 KPI tick

#### Scenario: 压缩时间线不改变生命周期清理
- **GIVEN** ShockWave、ChainBeam 或 FlareLand 已经渲染
- **WHEN** 对应组件生命周期结束或 REAL 抢占清场
- **THEN** 系统 SHALL 从 CinemaOverlay 移除对应 DOM
- **AND** active cap 与重复事件去重规则 SHALL 保持不变
