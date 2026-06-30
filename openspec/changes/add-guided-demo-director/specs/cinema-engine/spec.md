## ADDED Requirements

### Requirement: Guided Demo 主角锁定与人工接管兼容
系统 SHALL 在 Guided Demo 选定航班后锁定本次演示主角，使 Cinema 自动 DEMO 轮转和 AutoSeeder 不覆盖用户当前选择；用户人工接管地图时，该锁定 SHALL 保留，直到用户退出演示或选择新的演示航班。

#### Scenario: 选定演示航班锁定 DEMO 推进
- **GIVEN** Guided Demo 已选择航班 `BA178`
- **WHEN** TowerShell 渲染 AutoSeeder 和 GlobeMap
- **THEN** AutoSeeder SHALL 接收 demo locked 状态
- **AND** GlobeMap SHALL 高亮 `BA178`
- **AND** 下一次 Cinema cycle SHALL NOT 自动把当前演示主角替换为其它 DEMO 航班

#### Scenario: 用户接管不清理演示主角
- **GIVEN** Guided Demo 已选择航班 `BA178`
- **WHEN** 用户 wheel、drag、keydown 或 click 触发 Cinema manual 模式
- **THEN** Cinema SHALL 按既有规则显示 manual 状态
- **AND** Guided Demo SHALL 保留 `BA178` 作为演示主角
- **AND** 用户 SHALL 可以继续 Resume 或 Buy cover

### Requirement: Guided Demo 购买后导演式闭环
系统 SHALL 在 Guided Demo 购买成功后，把购买结果路由为 REAL protagonist，并沿用现有购买后压缩时间线播放 TrailDraw、ShockWave、ChainBeam 和 FlareLand。系统 MUST 先消费真实 WebSocket 事件；缺少真实事件时，才允许使用现有 fallback visual event 保障演示闭环。

#### Scenario: 购买成功路由 REAL protagonist
- **GIVEN** Guided Demo 用户已成功购买 policy `P1`
- **AND** 被购买航班有可投影坐标
- **WHEN** TowerShell 处理购买结果
- **THEN** Cinema SHALL 调用 REAL protagonist 路由
- **AND** protagonist SHALL 包含 policy id、flight id、callsign 和坐标
- **AND** playback lock SHALL 保持足够长以播放购买后闭环

#### Scenario: fallback 事件保持幂等
- **GIVEN** Guided Demo 购买后的真实 `claim.triggered`、`claim.settled` 或 `flight.landed` 事件已经到达
- **WHEN** 购买后 fallback 时间点到达
- **THEN** 系统 SHALL NOT 重复创建相同 policy 的 fallback visual event
- **AND** KPI tick、ChainBeam 和 FlareLand SHALL 不因重复 payload 额外计数

#### Scenario: 缺少坐标时不崩溃
- **GIVEN** Guided Demo 用户已成功购买 policy
- **AND** 被购买航班缺少可投影坐标
- **WHEN** TowerShell 尝试路由购买后闭环
- **THEN** 系统 SHALL 保持 Demo Rail 可见
- **AND** 系统 SHALL NOT 抛出运行时错误
- **AND** 用户 SHALL 可以退出演示或选择其它航班
