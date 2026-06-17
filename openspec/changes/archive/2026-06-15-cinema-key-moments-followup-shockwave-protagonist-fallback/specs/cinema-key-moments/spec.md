## ADDED Requirements

### Requirement: ShockWave 主角坐标兜底
系统 SHALL 在 `claim.triggered` 缺少可解析事件坐标时，使用当前 Cinema 主角坐标作为 ShockWave 的兜底渲染位置。

#### Scenario: 当前主角坐标渲染 ShockWave
- **GIVEN** cinema 当前 protagonist 的 `flightId` 与 `claim.triggered` payload `flight_id` 一致
- **AND** payload 包含 `policy_id`、`delay_minutes`、`source`
- **AND** payload 不包含可投影经纬度或可解析 `airport_iata`
- **WHEN** C2 key moment 在 STORY 窗口释放
- **THEN** 系统 SHALL 渲染 `data-testid="shockwave"`
- **AND** ShockWave SHALL 使用当前 protagonist 坐标作为中心点

#### Scenario: 无主角坐标时仍安全丢弃
- **GIVEN** `claim.triggered` payload 不包含可投影经纬度或可解析 `airport_iata`
- **AND** 当前没有可投影 protagonist
- **WHEN** EventChoreographer 处理该事件
- **THEN** 系统 SHALL NOT 渲染 ShockWave
- **AND** 系统 SHALL NOT 抛出运行时错误

### Requirement: C2 主角航班 ID 归一匹配
系统 SHALL 将后端 dated flight id 与前端 callsign protagonist 归一匹配，避免真实后端事件滞留在 pending queue。

#### Scenario: 后端 dated flight id 匹配 callsign 主角
- **GIVEN** 当前 Cinema protagonist 的 `flightId` 为 callsign `BA178`
- **AND** C2 key moment 的 `flightId` 为后端 flight id `BA178-20260615`
- **WHEN** C2 key moment 到达 STORY 释放窗口
- **THEN** 系统 SHALL 将该 moment 视为当前主角事件
- **AND** 系统 SHALL 在 CinemaOverlay 中释放对应 C2 动效

### Requirement: C2 WebSocket 事件幂等消费
系统 SHALL 对重复到达的相同 C2 WebSocket payload 执行幂等入库，避免开发模式重连或重复 socket 消费导致 KPI 与 flare 计数重复递增。

#### Scenario: 重复 flare payload 只计一次
- **GIVEN** 前端 WebSocket 收到两个内容相同的 `flare` payload
- **WHEN** event store 处理这些消息
- **THEN** `flares` 列表 SHALL 只新增一条记录
- **AND** typed cinema events SHALL 只新增一条 `flare` 事件

#### Scenario: 重复 typed cinema payload 只计一次
- **GIVEN** 前端 WebSocket 收到两个内容相同的 `claim.settled` payload
- **WHEN** event store 处理这些消息
- **THEN** typed cinema events SHALL 只新增一条 `claim.settled` 事件
- **AND** KPI tick SHALL NOT 因重复 payload 额外递增
