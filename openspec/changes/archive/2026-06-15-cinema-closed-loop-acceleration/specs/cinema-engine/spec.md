## MODIFIED Requirements

### Requirement: AutoSeeder 节奏与节流
系统 SHALL 在 cinema 模式下按 cycle 调用 demo seed 与 delay 注入，并保证每个 cycle 最多 1 次 seed-demo 和 1 次 DEMO inject-delay；DEMO inject-delay SHALL 在 cycle 第 3 秒触发，以支持约 8 秒内完成闭环演示。

#### Scenario: cycle 开头 seed 主角保单
- **GIVEN** cinema 进入新的 establish 阶段
- **WHEN** AutoSeeder 已选择 DEMO 主角和虚拟用户名
- **THEN** 系统 SHALL 调用 `POST /api/seed-demo`
- **AND** request body SHALL 包含 `protagonist_name`
- **AND** AutoSeeder SHALL 把选择出的 DEMO protagonist 写回 `CinemaState`

#### Scenario: 第 3 秒注入延误
- **GIVEN** 当前 DEMO cycle 已成功 seed
- **WHEN** cycle elapsed 为 2999ms
- **THEN** AutoSeeder SHALL NOT 调用 `POST /api/inject-delay`
- **WHEN** cycle elapsed 到达 3000ms 且系统仍处于 cinema 模式
- **THEN** AutoSeeder SHALL 调用 `POST /api/inject-delay`
- **AND** body SHALL 包含 DEMO protagonist 的 `flight_id`
- **AND** body SHALL 包含 demo 延误分钟数

#### Scenario: pause 期间不调用 API
- **GIVEN** 用户进入 interactive 或页面 hidden
- **WHEN** 原本的 seed 或 inject timer 到期
- **THEN** AutoSeeder SHALL 清理 timer
- **AND** AutoSeeder SHALL NOT 调用 `POST /api/seed-demo`
- **AND** AutoSeeder SHALL NOT 调用 `POST /api/inject-delay`

#### Scenario: 单 cycle 不重复调用
- **GIVEN** 当前 cycle 已经调用过 seed-demo 和 DEMO inject-delay
- **WHEN** React 重新渲染或 flights 列表刷新
- **THEN** AutoSeeder SHALL NOT 在同一 cycle 再次调用 seed-demo 或 DEMO inject-delay

### Requirement: REAL 抢占触发完整闭环
系统 SHALL 在 REAL `policy.created` 抢占成为当前 Cinema 主角后，自动且幂等地触发该真实航班的延误注入；`inject-delay` 成功写入后，后端 SHALL 立即运行目标航班的 ClaimEngine 检测，使 `claim.triggered`、`claim.settled` 与 `flight.landed` 可在当前压缩时间线内到达前端。

#### Scenario: REAL 主角立即触发 inject-delay
- **GIVEN** Cinema 当前没有 REAL inject dedup 记录
- **WHEN** 60 秒内的 REAL `policy.created` 事件抢占并成为当前 protagonist
- **THEN** 系统 SHALL 立即调用 `POST /api/inject-delay`
- **AND** 请求 body SHALL 包含当前 REAL protagonist 的 `flight_id`
- **AND** 请求 body SHALL 包含 demo 延误分钟数
- **AND** 系统 SHALL NOT 为该 REAL protagonist 调用 `POST /api/seed-demo`

#### Scenario: inject-delay 成功后立即检测目标航班
- **GIVEN** `/inject-delay` 或 `/admin/inject-delay` 已验证目标 flight 存在
- **WHEN** endpoint 写入该 flight 的 delay override
- **THEN** 后端 SHALL 在返回响应前调用 `ClaimEngine.run_for_flight(flight_id)`
- **AND** `run_for_flight` SHALL 只扫描该 flight 的 ACTIVE policy
- **AND** 现有 30 秒后台 `ClaimEngine.run_once()` SHALL 继续保留

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

### Requirement: demo API 安全入口
系统 SHALL 提供前端可调用的 demo seed/inject 入口，且不得把 admin token 暴露给浏览器；public 与 admin inject-delay 入口均 SHALL 在成功写入 delay 后立即触发目标航班 ClaimEngine 检测。

#### Scenario: seed-demo 支持 protagonist_name
- **GIVEN** AutoSeeder 选择了主角姓名
- **WHEN** 调用 `POST /api/seed-demo`
- **THEN** 后端 SHALL 接受 `protagonist_name`
- **AND** 响应 SHALL 包含已创建的 demo policy 与主角 flight id

#### Scenario: 浏览器不携带 ADMIN_TOKEN
- **GIVEN** 前端运行在浏览器
- **WHEN** 它调用 seed-demo 或 inject-delay
- **THEN** 它 SHALL 使用不带 token 的 `/api/seed-demo` 与 `/api/inject-delay`
- **AND** 现有 `/api/admin/seed-demo` 与 `/api/admin/inject-delay` SHALL 继续要求 `X-Admin-Token`

#### Scenario: inject-delay 成功后立即运行目标航班检测
- **GIVEN** `/api/inject-delay` 或 `/api/admin/inject-delay` 收到已存在 flight 的请求
- **WHEN** 后端保存 delay override
- **THEN** 后端 SHALL 调用 `ClaimEngine.run_for_flight(flight_id)`
- **AND** response body SHALL 保持现有 `flight_id` 与 `delay_minutes` shape
- **AND** ClaimEngine SHALL 输出 INFO 日志用于现场 tail 验证

#### Scenario: demo 入口关闭时返回可处理错误
- **GIVEN** demo/autoseed 开关关闭
- **WHEN** 浏览器调用 `/api/seed-demo` 或 `/api/inject-delay`
- **THEN** 后端 SHALL 返回 403 或 503
- **AND** 前端 SHALL 进入 `DEMO · OFFLINE` 或 degraded 可见状态
- **AND** 后端 SHALL NOT 调用 `ClaimEngine.run_for_flight`
