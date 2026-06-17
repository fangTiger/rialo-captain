## MODIFIED Requirements

### Requirement: 主角选择与真实事件抢占
系统 SHALL 使用 Spotlight Hybrid 选择主角：真实事件优先，DEMO 主角兜底；没有真实事件时，DEMO 主角 SHALL 在可用候选航班中轮转，不得固定同一架，候选耗尽后再循环；REAL `policy.created` 在任意 phase 到达时 SHALL 立即清场抢占当前故事，但 1 秒内的 REAL burst SHALL 只切换第一个事件，其余按 FIFO 入队。

#### Scenario: 没有真实事件时选择轮转 DEMO 主角
- **GIVEN** 60 秒内没有可用真实事件
- **AND** live flights 中存在多架可定位且 `on_ground=false` 的候选航班
- **WHEN** cinema cycle 进入 establish 阶段
- **THEN** 系统 SHALL 从候选航班中选择 DEMO 主角
- **AND** 每个 cycle SHALL 选择不同候选直到候选耗尽后再从头循环
- **AND** 页面挂载时的首次 DEMO 选择 SHALL 使用不持久化的 session-only seed，避免刷新后总是固定第一架
- **AND** `CinemaState.protagonist`、`ProtagonistBadge`、`GlobeMap` 主角高亮与 AutoSeeder seed-demo 使用的主角 SHALL 保持一致
- **AND** `ProtagonistBadge` SHALL 显示 `DEMO`

#### Scenario: DEMO 轮转跳过不可用候选
- **GIVEN** live flights 中包含落地航班、缺少经纬度航班或 ETA 不适合的航班
- **WHEN** 系统为 DEMO cycle 选择主角
- **THEN** 系统 SHALL 跳过不可用候选
- **AND** 轮转顺序 SHALL 只在可定位且 `on_ground=false` 且 ETA 可用的候选之间计算

#### Scenario: 任意 phase 真实事件立即清场抢占
- **GIVEN** 系统处于 establish、zoom-in、story、zoom-out 或 rest 任意阶段
- **WHEN** 60 秒内的 `policy.created` 真实事件到达且可映射到航班
- **THEN** 系统 SHALL 立即把该事件设为 REAL 主角
- **AND** `ProtagonistBadge` SHALL 显示 `REAL · LIVE`
- **AND** 当前 DEMO 主角 SHALL 不再继续播放

#### Scenario: REAL 抢占时重置 cycle
- **GIVEN** REAL `policy.created` 事件触发立即抢占
- **WHEN** Cinema state 应用该事件
- **THEN** `cycleStartedAt` SHALL 重置为当前墙钟时间
- **AND** `phase` SHALL 设置为 `establish`
- **AND** `cameraTarget` SHALL 设置为 `null`
- **AND** 后续 STORY 时间窗 SHALL 以新 REAL 主角和新 cycle 为准

#### Scenario: REAL 抢占时清空 transient moments
- **GIVEN** C2 key moments 或 C3 TrailDraw 当前存在 active 或 pending visual moments
- **WHEN** REAL `policy.created` 事件立即抢占当前故事
- **THEN** 系统 SHALL 清空 key moment queue 的 active 与 pending moments
- **AND** ShockWave、ChainBeam、FlareLand 和 TrailDraw 旧 DOM SHALL 从 CinemaOverlay 移除
- **AND** 业务事件 ring buffer SHALL 保留原始事件记录

#### Scenario: REAL burst 1 秒内只切第一个
- **GIVEN** 第一条 REAL `policy.created` 事件已经立即抢占当前故事
- **WHEN** 1 秒内又收到一条或多条可映射 REAL `policy.created` 事件
- **THEN** 系统 SHALL 保持第一条 REAL 事件作为当前 protagonist
- **AND** 后续 REAL 事件 SHALL 按 FIFO 加入真实事件队列
- **AND** 队列容量与堆积提示 SHALL 继续遵守现有规则

#### Scenario: 真实队列容量与堆积显示
- **GIVEN** REAL 主角队列已包含 3 条待播事件
- **WHEN** 第 4 条真实事件到达且未触发立即抢占
- **THEN** 系统 SHALL 限制队列最多保留 3 条可播放事件
- **AND** `ProtagonistBadge` SHALL 显示堆积数量提示
