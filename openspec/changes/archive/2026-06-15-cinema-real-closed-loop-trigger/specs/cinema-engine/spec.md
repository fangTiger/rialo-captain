## ADDED Requirements

### Requirement: REAL 抢占触发完整闭环
系统 SHALL 在 REAL `policy.created` 抢占成为当前 Cinema 主角后，自动且幂等地触发该真实航班的延误注入，使后端按现有 ClaimEngine 链路广播 `claim.triggered`、`claim.settled` 与 `flight.landed`，并由 C2/C1 事件编排渲染完整闭环。

#### Scenario: REAL 主角立即触发 inject-delay
- **GIVEN** Cinema 当前没有 REAL inject dedup 记录
- **WHEN** 60 秒内的 REAL `policy.created` 事件抢占并成为当前 protagonist
- **THEN** 系统 SHALL 立即调用 `POST /api/inject-delay`
- **AND** 请求 body SHALL 包含当前 REAL protagonist 的 `flight_id`
- **AND** 请求 body SHALL 包含 demo 延误分钟数
- **AND** 系统 SHALL NOT 为该 REAL protagonist 调用 `POST /api/seed-demo`

#### Scenario: REAL inject 后沿用现有 C2 闭环事件链
- **GIVEN** REAL protagonist 的 inject-delay 请求已成功
- **WHEN** 后端 ClaimEngine 检测到该真实保单满足延误条件并广播事件
- **THEN** 前端 SHALL 通过现有 EventChoreographer 消费 `claim.triggered`
- **AND** 前端 SHALL 通过现有 EventChoreographer 消费 `claim.settled`
- **AND** 前端 SHALL 通过现有 EventChoreographer 消费 `flight.landed`
- **AND** 系统 SHALL NOT 在前端伪造 `claim.triggered`、`claim.settled` 或 `flight.landed`

#### Scenario: 同一 REAL 主角重复渲染不重复 inject
- **GIVEN** 当前 REAL protagonist 已经触发过 inject-delay
- **AND** dedup key 由 `cycleId`、`flight_id` 与 `policy_id` 或等价事件 id 组成
- **WHEN** React 重新渲染、EventChoreographer effect 重新执行或相同 WS payload 重复到达
- **THEN** 系统 SHALL NOT 再次调用 `POST /api/inject-delay` 给同一个 REAL protagonist
- **AND** DEMO cycle 的 inject-delay 节流 SHALL 保持独立

#### Scenario: REAL burst 中每个成为主角的事件各自 inject
- **GIVEN** 第一条 REAL `policy.created` 已经立即抢占并触发 inject-delay
- **WHEN** 1 秒内第二条 REAL `policy.created` 到达并进入 REAL queue
- **THEN** 系统 SHALL NOT 立即为第二条 queued REAL 调用 inject-delay
- **WHEN** queued REAL 在后续 cycle 成为当前 protagonist
- **THEN** 系统 SHALL 为该 queued REAL 调用一次 `POST /api/inject-delay`
- **AND** 每条成为当前 protagonist 的 REAL SHALL 使用自己的 dedup key

#### Scenario: REAL inject 失败显示短暂提示
- **GIVEN** 当前 protagonist 为 REAL
- **WHEN** `POST /api/inject-delay` 返回 4xx、5xx 或网络错误
- **THEN** `ModeIndicator` SHALL 显示 `REAL · INJECT FAILED`
- **AND** 该提示 SHALL 短暂显示后自动清除
- **AND** 系统 SHALL NOT 阻塞用户 click、wheel、drag、keydown 或 Esc 接管/恢复
- **AND** 系统 SHALL NOT 在同一 dedup key 下重复刷请求
