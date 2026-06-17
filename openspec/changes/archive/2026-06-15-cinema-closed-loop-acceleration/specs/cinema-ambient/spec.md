## MODIFIED Requirements

### Requirement: TrailDraw STORY 触发
系统 SHALL 在当前主角闭环关键时刻前为主角触发一次 `TrailDraw`，并把播放窗口对齐到 cycle 第 3-6 秒，使航迹比 ShockWave 至少提前约 2 秒出现。

#### Scenario: 第 3 秒触发 TrailDraw
- **GIVEN** 当前处于 cinema 模式且存在可投影 protagonist
- **WHEN** cycle elapsed 为 2999ms
- **THEN** 系统 SHALL NOT 创建 TrailDraw active item
- **WHEN** cycle elapsed 到达 3000ms
- **THEN** 系统 SHALL 创建一个 TrailDraw active item
- **AND** key SHALL 包含 `cycleStartedAt` 与 `protagonist.flightId`

#### Scenario: 同一 cycle 和主角不重复触发
- **GIVEN** 当前 cycle/protagonist 已经触发过 TrailDraw
- **WHEN** phase 重新渲染或 flights 列表刷新
- **THEN** 系统 SHALL NOT 创建第二个相同 TrailDraw

#### Scenario: 非 cinema 或无主角不触发
- **GIVEN** 系统处于 manual、paused-hidden、degraded 或没有可投影 protagonist
- **WHEN** phase 变化或 timer 到达 3 秒窗口
- **THEN** 系统 SHALL NOT 渲染新的 TrailDraw

#### Scenario: TrailDraw 生命周期结束后清理
- **GIVEN** TrailDraw 已开始播放
- **WHEN** cycle elapsed 到达约 6000ms 或组件生命周期结束
- **THEN** TrailDraw DOM SHALL 从 overlay 中移除

#### Scenario: REAL 抢占重置 TrailDraw 节奏
- **GIVEN** DEMO TrailDraw 正在 active
- **WHEN** REAL `policy.created` 立即抢占并重置 cycle
- **THEN** 系统 SHALL 清理旧 TrailDraw
- **AND** 新 REAL protagonist SHALL 在自己的 cycle 第 3 秒触发 TrailDraw
