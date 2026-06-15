## Purpose
cinema-key-moments 能力定义 Rialo-Captain Cinema 大屏 C2 闭环关键时刻：延误触发、赔付链路、航班落地三类短生命周期视觉动效及其事件路由、时间线、性能与降级行为。

## Requirements

### Requirement: claim.triggered 后端事件
系统 SHALL 在 ClaimEngine 判断保单延误条件命中时广播 `claim.triggered`，供 Cinema C2 ShockWave 使用，并保持后续 `claim.settled`、`flight.landed`、`flare` payload 兼容。

#### Scenario: 条件命中后广播 claim.triggered
- **GIVEN** ClaimEngine 处理 ACTIVE policy 且 observation 满足 delay 条件
- **WHEN** 系统准备触发 mock claim settlement
- **THEN** WebSocket SHALL 先广播 `claim.triggered`
- **AND** payload SHALL 包含 `flight_id`、`policy_id`、`delay_minutes`、`source`
- **AND** payload SHALL 包含 `airport_iata` 或可投影的经纬度字段

#### Scenario: 未命中条件不广播 claim.triggered
- **GIVEN** ClaimEngine 处理 ACTIVE policy
- **WHEN** observation 未满足 delay 条件
- **THEN** WebSocket SHALL NOT 广播 `claim.triggered`
- **AND** 系统 SHALL NOT 创建 ChainBeam 或 FlareLand 相关事件

#### Scenario: settled 与 landed payload 不新增字段
- **GIVEN** ClaimEngine 广播 `claim.triggered`
- **WHEN** 同一 policy 后续完成 settlement 和 landed 广播
- **THEN** `claim.settled` payload SHALL 保持 C1 字段集合兼容
- **AND** `flight.landed` payload SHALL 保持 C1 字段集合兼容
- **AND** 现有 `flare` SHALL 继续广播

### Requirement: C2 事件归一化与主角关联
系统 SHALL 将 `claim.triggered`、`claim.settled`、`flight.landed` 归一化为 key moment，并只为当前主角或 60 秒内待播主角播放视觉动效。

#### Scenario: 当前主角事件进入 key moment queue
- **GIVEN** cinema 当前 protagonist 的 `flightId` 与事件 payload `flight_id` 一致
- **WHEN** WebSocket 收到 `claim.triggered`、`claim.settled` 或 `flight.landed`
- **THEN** EventChoreographer SHALL 创建对应 key moment 描述
- **AND** 该 moment SHALL 在 CinemaOverlay 内可渲染

#### Scenario: 非主角事件不污染当前故事
- **GIVEN** cinema 当前 protagonist 的 `flightId` 与事件 payload `flight_id` 不一致
- **WHEN** WebSocket 收到 C2 key moment 事件
- **THEN** 系统 SHALL NOT 立即渲染该事件的 C2 动效
- **AND** 若该事件 60 秒内没有成为待播或当前主角，系统 SHALL 丢弃其视觉 moment

#### Scenario: 重复事件只播放一次
- **GIVEN** eventStore 中存在相同 id 的 key moment 事件
- **WHEN** React 重新渲染或 EventChoreographer effect 重新执行
- **THEN** 系统 SHALL NOT 重复创建 ShockWave、ChainBeam 或 FlareLand

### Requirement: STORY 时间窗释放关键时刻
系统 SHALL 把提前到达的 C2 事件排到当前主角 STORY phase 的对应时间窗播放，以匹配 cinema 30 秒时间线。

#### Scenario: claim.triggered 在 STORY 窗口触发 ShockWave
- **GIVEN** 当前主角的 `claim.triggered` 事件已经到达
- **WHEN** cinema 进入 STORY phase 且 cycle elapsed 到达 15 秒窗口
- **THEN** 系统 SHALL 渲染 ShockWave
- **AND** ShockWave SHALL 以该事件的机场或 fallback 坐标为中心

#### Scenario: claim.settled 在 ShockWave 后触发 ChainBeam
- **GIVEN** 同一 policy 的 `claim.triggered` 与 `claim.settled` 已到达
- **WHEN** ShockWave 已启动约 1 秒
- **THEN** 系统 SHALL 渲染 ChainBeam
- **AND** ChainBeam SHALL 展示 `claim.settled` payload 中的 mock `tx_hash`
- **AND** C1 KPI tick SHALL 继续触发

#### Scenario: flight.landed 在 ChainBeam 后触发 FlareLand
- **GIVEN** 同一 policy 的 `flight.landed` 已到达
- **WHEN** ChainBeam 已启动约 4 秒或 landed 事件在 STORY phase 到达
- **THEN** 系统 SHALL 渲染 FlareLand
- **AND** FlareLand SHALL 以当前主角航班位置或 event payload 坐标为中心

#### Scenario: 无 trigger 的 settled 仍可播放 ChainBeam
- **GIVEN** 当前主角只收到 `claim.settled` 且没有对应 `claim.triggered`
- **WHEN** cinema 已处于 STORY phase
- **THEN** 系统 SHALL 渲染 ChainBeam
- **AND** 系统 SHALL NOT 因缺少 ShockWave 阻塞 KPI tick

### Requirement: ShockWave 延误冲击波
系统 SHALL 在机场位置渲染 ShockWave，用多层同心 ring 的 scale 与 fade 表示延误触发。

#### Scenario: ShockWave 显示机场爆红圈
- **GIVEN** EventChoreographer 创建了 ShockWave moment
- **WHEN** CinemaOverlay 渲染该 moment
- **THEN** 页面 SHALL 包含 `data-testid="shockwave"`
- **AND** ShockWave SHALL 显示 `AT RISK` 或 delay 文案
- **AND** ShockWave SHALL 使用 `transform` 与 `opacity` 动画 ring

#### Scenario: ShockWave 生命周期结束后清理
- **GIVEN** ShockWave 已开始播放
- **WHEN** 约 2 秒生命周期结束
- **THEN** ShockWave DOM SHALL 从 CinemaOverlay 移除
- **AND** 不得留下 active timer 或重复 ring

#### Scenario: ShockWave 坐标不可解析时安全丢弃
- **GIVEN** `claim.triggered` payload 没有可用经纬度、airport_iata，也没有当前主角坐标
- **WHEN** EventChoreographer 处理该事件
- **THEN** 系统 SHALL NOT 渲染 ShockWave
- **AND** 系统 SHALL NOT 抛出运行时错误

### Requirement: ChainBeam 链上光线
系统 SHALL 在结算事件到达后渲染从机场到 hangar 锚点的 ChainBeam，并展示 mock tx hash。

#### Scenario: ChainBeam 从机场飞到 hangar
- **GIVEN** EventChoreographer 创建了 ChainBeam moment
- **WHEN** CinemaOverlay 渲染该 moment
- **THEN** 页面 SHALL 包含 `data-testid="chainbeam"`
- **AND** ChainBeam SHALL 以机场坐标作为起点
- **AND** ChainBeam SHALL 以 hangar 视觉锚点作为终点
- **AND** pulse 与 tx hash 文本 SHALL 使用 CSS transform/opacity

#### Scenario: ChainBeam 展示 mock tx hash
- **GIVEN** `claim.settled` payload 包含 `tx_hash`
- **WHEN** ChainBeam 渲染
- **THEN** ChainBeam SHALL 显示 tx hash 的短格式文本
- **AND** tx hash 文本 SHALL 设置 `will-change: transform`

#### Scenario: ChainBeam 生命周期结束后清理
- **GIVEN** ChainBeam 已开始播放
- **WHEN** 约 4 秒生命周期结束
- **THEN** ChainBeam DOM SHALL 从 CinemaOverlay 移除
- **AND** 后续同 policy landed 事件仍可触发 FlareLand

### Requirement: FlareLand 落地确认
系统 SHALL 在落地事件到达后渲染 FlareLand，表示主角航班闭环完成。

#### Scenario: FlareLand 显示落地收束
- **GIVEN** EventChoreographer 创建了 FlareLand moment
- **WHEN** CinemaOverlay 渲染该 moment
- **THEN** 页面 SHALL 包含 `data-testid="flareland"`
- **AND** FlareLand SHALL 显示 `FLARE` 文案或等价状态标识
- **AND** FlareLand SHALL 使用 transform/opacity 完成收束和 ping ring

#### Scenario: FlareLand 生命周期结束后清理
- **GIVEN** FlareLand 已开始播放
- **WHEN** 约 2 秒生命周期结束
- **THEN** FlareLand DOM SHALL 从 CinemaOverlay 移除
- **AND** CinemaOverlay SHALL 继续保留 ProtagonistBadge

### Requirement: Overlay 交互与性能预算
系统 SHALL 在渲染 C2 key moments 时保持地图交互、60fps 预算与 DOM 数量上限。

#### Scenario: C2 动效不拦截地图交互
- **GIVEN** ShockWave、ChainBeam 或 FlareLand 正在播放
- **WHEN** 用户点击、hover、wheel 或 drag GlobeMap
- **THEN** CinemaOverlay SHALL NOT 拦截这些事件
- **AND** C1 manual takeover 与飞机点击导航 SHALL 保持原行为

#### Scenario: 动效只使用 transform 与 opacity
- **GIVEN** C2 动效组件渲染
- **WHEN** 测试检查组件样式与 class
- **THEN** 动画 SHALL 只依赖 CSS `transform`、`opacity` 或 SVG stroke opacity
- **AND** 系统 SHALL NOT 引入 framer-motion、GSAP 或新动画依赖

#### Scenario: burst 事件限制 active moments
- **GIVEN** WebSocket 短时间内收到多条 C2 key moment 事件
- **WHEN** active moment 数量超过 6
- **THEN** 系统 SHALL 丢弃最旧 active moment
- **AND** CinemaOverlay SHALL NOT 无限增加 DOM 节点

### Requirement: Reduced Motion 支持
系统 SHALL 尊重 `prefers-reduced-motion: reduce`，在用户要求减少动效时改用短暂静态状态。

#### Scenario: reduced motion 下 ShockWave 静态显示
- **GIVEN** 浏览器匹配 `prefers-reduced-motion: reduce`
- **WHEN** ShockWave moment 播放
- **THEN** 系统 SHALL 显示静态风险圈
- **AND** 系统 SHALL NOT 播放 scale 动画

#### Scenario: reduced motion 下 ChainBeam 静态显示
- **GIVEN** 浏览器匹配 `prefers-reduced-motion: reduce`
- **WHEN** ChainBeam moment 播放
- **THEN** 系统 SHALL 显示静态线和 tx hash
- **AND** 系统 SHALL NOT 播放沿线移动 pulse

#### Scenario: reduced motion 下 FlareLand 静态显示
- **GIVEN** 浏览器匹配 `prefers-reduced-motion: reduce`
- **WHEN** FlareLand moment 播放
- **THEN** 系统 SHALL 显示静态 FLARE 状态
- **AND** 系统 SHALL NOT 播放收束 transform 动画
