## Purpose
cinema-ambient 能力定义 Rialo-Captain Cinema 大屏 C3 氛围装饰：HeatmapBg 全局保单热斑、TrailDraw 主角航迹、policy.created 数据接入、层级交互共存、reduced motion 与性能预算。

## Requirements


### Requirement: policy.created 后端事件
系统 SHALL 在真实用户成功创建保单后广播 `policy.created` WebSocket 事件，供 Cinema REAL 主角和 HeatmapBg 使用，且不得改变 `POST /policies` 的响应结构。

#### Scenario: 保单创建后广播 policy.created
- **GIVEN** 已登录用户调用 `POST /policies` 且保单创建、合约 watch、数据库提交成功
- **WHEN** 后端完成当前响应准备
- **THEN** WebSocket SHALL 广播 `policy.created`
- **AND** payload SHALL 包含 `policy_id`、`flight_id`、`source`、`created_at`
- **AND** `source` SHALL 为 `real`
- **AND** HTTP response body SHALL 保持现有 `PolicyPublic` schema

#### Scenario: policy.created 尽力携带可投影坐标
- **GIVEN** 被投保航班存在当前经纬度、flight cache 状态或可解析 last_state
- **WHEN** 后端广播 `policy.created`
- **THEN** payload SHOULD 包含 `longitude`、`latitude` 和 `callsign`
- **AND** 坐标 SHALL 使用数字类型

#### Scenario: 坐标缺失时仍广播业务事件
- **GIVEN** 保单创建成功但后端无法解析航班经纬度
- **WHEN** 后端广播 `policy.created`
- **THEN** payload SHALL 仍包含 `policy_id`、`flight_id`、`source`、`created_at`
- **AND** 前端 SHALL 能安全忽略该事件的 Heatmap 点

### Requirement: Heatmap 数据点收集
系统 SHALL 从 `policy.created` 事件中增量收集可投影的保单坐标，并维护 5 分钟窗口内的 heatmap 数据点。

#### Scenario: policy.created 增量加入 heatmap 数据点
- **GIVEN** WebSocket 收到 `policy.created` 且 payload 包含有效 `longitude` 与 `latitude`
- **WHEN** EventChoreographer 处理该事件
- **THEN** 系统 SHALL 调用 ambient heatmap 路由
- **AND** Heatmap 数据 SHALL 增加一个包含 event id、坐标、createdAt 和 weight 的点

#### Scenario: 无坐标 policy.created 不污染 heatmap
- **GIVEN** WebSocket 收到 `policy.created` 但 payload 缺少有效经纬度
- **WHEN** Heatmap 数据收集器处理该事件
- **THEN** 系统 SHALL NOT 新增 heatmap 点
- **AND** 系统 SHALL NOT 抛出运行时错误

#### Scenario: 5 分钟窗口清理旧点
- **GIVEN** Heatmap 数据中存在超过 5 分钟的 policy point
- **WHEN** 5 分钟重算或 prune timer 到达
- **THEN** 系统 SHALL 移除过期点
- **AND** 新近点 SHALL 保留

#### Scenario: burst 事件限制点数上限
- **GIVEN** WebSocket 短时间收到大量 `policy.created`
- **WHEN** heatmap raw point 数超过配置上限
- **THEN** 系统 SHALL 保留最新或权重最高的有限点集
- **AND** HeatmapBg SHALL NOT 无限增加 SVG 节点

### Requirement: HeatmapBg 氛围层
系统 SHALL 在 TowerShell 地图底层渲染 `HeatmapBg`，用 SVG radial-gradient 多焦点呈现过去 5 分钟保单密度。

#### Scenario: HeatmapBg 持续存在于地图底层
- **GIVEN** 用户打开 `/`
- **WHEN** TowerShell 渲染 cinema 大屏
- **THEN** 页面 SHALL 包含 `data-testid="heatmap-bg"`
- **AND** HeatmapBg SHALL 使用 SVG 元素渲染
- **AND** HeatmapBg SHALL NOT 使用 canvas

#### Scenario: HeatmapBg 使用 radial-gradient 多焦点
- **GIVEN** Heatmap 数据中存在多个可投影点
- **WHEN** HeatmapBg 渲染
- **THEN** SVG SHALL 包含 radial-gradient 或等价 SVG 径向渐变定义
- **AND** 每个可见焦点 SHALL 根据当前 map viewport 投影到屏幕坐标

#### Scenario: HeatmapBg 呼吸效果不触发布局重排
- **GIVEN** HeatmapBg 处于普通 motion 环境
- **WHEN** 组件播放氛围动画
- **THEN** 动画 SHALL 只改变 opacity、transform 或 SVG opacity
- **AND** 系统 SHALL NOT 通过 layout 属性驱动每帧动画

### Requirement: TrailDraw STORY 触发
系统 SHALL 在当前主角闭环关键时刻前为主角触发一次 `TrailDraw`，并把播放窗口对齐到 cycle 第 4-5 秒，使航迹比 ShockWave 至少提前约 2 秒出现。

#### Scenario: 第 4 秒触发 TrailDraw
- **GIVEN** 当前处于 cinema 模式且存在可投影 protagonist
- **WHEN** cycle elapsed 为 3999ms
- **THEN** 系统 SHALL NOT 创建 TrailDraw active item
- **WHEN** cycle elapsed 到达 4000ms
- **THEN** 系统 SHALL 创建一个 TrailDraw active item
- **AND** key SHALL 包含 `cycleStartedAt` 与 `protagonist.flightId`

#### Scenario: 同一 cycle 和主角不重复触发
- **GIVEN** 当前 cycle/protagonist 已经触发过 TrailDraw
- **WHEN** phase 重新渲染或 flights 列表刷新
- **THEN** 系统 SHALL NOT 创建第二个相同 TrailDraw

#### Scenario: 非 cinema 或无主角不触发
- **GIVEN** 系统处于 manual、paused-hidden、degraded 或没有可投影 protagonist
- **WHEN** phase 变化或 timer 到达 4 秒窗口
- **THEN** 系统 SHALL NOT 渲染新的 TrailDraw

#### Scenario: TrailDraw 生命周期结束后清理
- **GIVEN** TrailDraw 已开始播放
- **WHEN** cycle elapsed 到达约 5000ms 或组件生命周期结束
- **THEN** TrailDraw DOM SHALL 从 overlay 中移除

#### Scenario: REAL 抢占重置 TrailDraw 节奏
- **GIVEN** DEMO TrailDraw 正在 active
- **WHEN** REAL `policy.created` 立即抢占并重置 cycle
- **THEN** 系统 SHALL 清理旧 TrailDraw
- **AND** 新 REAL protagonist SHALL 在自己的 cycle 第 4 秒触发 TrailDraw

### Requirement: TrailDraw 航迹几何
系统 SHALL 使用当前主角坐标和可用航向信息生成可投影的短航迹；缺少真实历史航点时使用 deterministic fallback。

#### Scenario: 使用 heading 生成主角短航迹
- **GIVEN** 当前 protagonist 有经纬度且 live flight 有有效 heading
- **WHEN** TrailDraw 生成 path
- **THEN** path SHALL 包含沿 heading 推导的多个投影点
- **AND** path 终点 SHALL 靠近当前 protagonist 坐标

#### Scenario: 缺少 heading 使用 fallback path
- **GIVEN** 当前 protagonist 有经纬度但没有有效 heading
- **WHEN** TrailDraw 生成 path
- **THEN** 系统 SHALL 生成一条 deterministic fallback 航迹
- **AND** fallback SHALL 使用同一投影坐标系

#### Scenario: 坐标不可解析时安全跳过
- **GIVEN** 当前 protagonist 缺少可投影经纬度或 viewport size 无效
- **WHEN** TrailDraw 尝试生成 path
- **THEN** 系统 SHALL NOT 渲染 TrailDraw
- **AND** 系统 SHALL NOT 抛出运行时错误

### Requirement: C3 层级与交互共存
系统 SHALL 让 HeatmapBg、TrailDraw 与 C1/C2 图层共存，且不得阻挡地图交互或改变已有关键时刻行为。

#### Scenario: HeatmapBg 不阻挡 GlobeMap
- **GIVEN** HeatmapBg 正在显示
- **WHEN** 用户 click、hover、wheel 或 drag GlobeMap
- **THEN** HeatmapBg SHALL NOT 拦截事件
- **AND** C1 manual takeover 与点击飞机导航 SHALL 保持原行为

#### Scenario: TrailDraw 位于 C2 moments 下方
- **GIVEN** TrailDraw 与 ShockWave、ChainBeam 或 FlareLand 同时 active
- **WHEN** CinemaOverlay 渲染
- **THEN** TrailDraw SHALL 位于 C2 key moments 的视觉下层
- **AND** ProtagonistBadge SHALL 继续可见

#### Scenario: C3 不影响 KPI tick 与 C2 callbacks
- **GIVEN** C3 heatmap 或 trail 正在播放
- **WHEN** WebSocket 收到 `claim.settled` 或 `flight.landed`
- **THEN** C1 KPI tick 与 C2 ChainBeam/FlareLand SHALL 继续按既有规则触发

### Requirement: Reduced Motion 支持
系统 SHALL 尊重 `prefers-reduced-motion: reduce`，在用户要求减少动效时用静态 Heatmap 和完整 Trail path 替代呼吸/一笔画动画。

#### Scenario: reduced motion 下 HeatmapBg 静态显示
- **GIVEN** 浏览器匹配 `prefers-reduced-motion: reduce`
- **WHEN** HeatmapBg 渲染
- **THEN** 系统 SHALL 显示静态 radial-gradient 热斑
- **AND** 系统 SHALL NOT 播放 breath scale 或 opacity 动画

#### Scenario: reduced motion 下 TrailDraw 完整显示
- **GIVEN** 浏览器匹配 `prefers-reduced-motion: reduce`
- **WHEN** TrailDraw 渲染
- **THEN** 系统 SHALL 直接显示完整航迹 path
- **AND** 系统 SHALL NOT 播放 stroke-dashoffset 一笔画动画

### Requirement: C3 性能预算
系统 SHALL 使用轻量 SVG/CSS 实现 C3 氛围装饰，并限制 DOM、timer 与重算成本。

#### Scenario: 不引入新动画依赖
- **GIVEN** C3 实现完成
- **WHEN** 检查前端依赖清单
- **THEN** 系统 SHALL NOT 新增 framer-motion、GSAP、canvas heatmap 库或图标库

#### Scenario: Heatmap 重算节流
- **GIVEN** HeatmapBg 已挂载并持续收到 policy events
- **WHEN** 未到 5 分钟重算窗口
- **THEN** 系统 SHALL NOT 执行完整 heatmap 重算循环
- **AND** 新事件 SHALL 通过增量路径可见

#### Scenario: unmount 清理 timer
- **GIVEN** TowerShell 或 C3 hooks 已挂载
- **WHEN** 组件 unmount
- **THEN** 系统 SHALL 清理 heatmap prune timer 与 TrailDraw lifecycle timer
- **AND** 后续 timer tick SHALL NOT 更新已卸载组件 state
