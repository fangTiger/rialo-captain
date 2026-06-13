## ADDED Requirements

### Requirement: OpenSky 实时航班接入

系统 SHALL 通过 OpenSky Network 公共 API 拉取全球实时航班位置与状态，并维持 30 秒 in-memory 缓存。

#### Scenario: 首次大屏加载
- **GIVEN** 一个新建会话连接 `GET /flights/live`
- **WHEN** 后端调用 OpenSky `/states/all`
- **THEN** 返回不少于 50 架在飞航班（每条含 `flight_id`、`callsign`、`lat`、`lon`、`velocity`、`origin_country`）

#### Scenario: 30 秒内重复请求命中缓存
- **GIVEN** 30 秒内已成功拉取一次
- **WHEN** 再次请求 `GET /flights/live`
- **THEN** 返回缓存数据，不调用 OpenSky

#### Scenario: OpenSky 失败时指数退避
- **GIVEN** OpenSky 连续返回 5xx 或超时
- **WHEN** 后台 fetcher 触发
- **THEN** 重试间隔 1s → 2s → 4s → ... → 60s 上限

### Requirement: degraded mode（数据陈旧标记）

系统 SHALL 在 OpenSky 不可用时维持最近一次缓存数据并显式标记 stale，禁止伪装实时。

#### Scenario: OpenSky 5xx 时返回 stale 数据
- **GIVEN** OpenSky 当前不可用、上次成功拉取距今 > 60 秒
- **WHEN** 客户端请求 `GET /flights/live`
- **THEN** 返回最后已知数据 + `data_stale: true`、`stale_seconds: <integer>`

#### Scenario: 大屏显示 DATA STALE 徽章
- **GIVEN** `/flights/live` 返回 `data_stale: true`
- **WHEN** Tower 页面渲染
- **THEN** 顶部出现琴黄色 `DATA STALE` 徽章，状态栏 LED 变黄

### Requirement: 航班详情与历史延误率

系统 SHALL 提供单航班详情端点，附带基于累积观测的延误率统计。

#### Scenario: 查询缓存内航班
- **GIVEN** 一个当前在飞的 `flight_id`
- **WHEN** `GET /flights/:id`
- **THEN** 返回完整 state、scheduled_dep / scheduled_arr、最近 30 天延误率分布（按周分桶）

#### Scenario: 查询未知航班
- **GIVEN** 一个不存在的 `flight_id`
- **WHEN** `GET /flights/:id`
- **THEN** 返回 `404`

### Requirement: 航班 ID 规范

系统 SHALL 使用 `<callsign>-<YYYYMMDD>` 作为 `flight_id` 主键（如 `BA178-20260613`），保证同一航班号不同日期可区分。

#### Scenario: 同航班号不同日期独立
- **GIVEN** 6 月 13 和 6 月 14 都有 `BA178`
- **WHEN** 两者均出现在 OpenSky 状态中
- **THEN** 系统将其作为两条不同 flight 记录存储
