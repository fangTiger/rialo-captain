# settlement-evidence Specification

## Purpose
TBD - created by archiving change add-settlement-evidence-replay. Update Purpose after archive.
## Requirements
### Requirement: 持久化保单证据事件
系统 SHALL 为保单生命周期中的关键动作持久化证据事件，并按创建时间、内部事件顺序和事件 id 形成稳定 timeline。每条事件 MUST 关联 `policy_id` 与 `flight_id`，可选关联 `claim_id`，并包含 `type`、`title`、`source`、`created_at` 与结构化 `payload`。

#### Scenario: 保单创建记录基础事件
- **GIVEN** 已登录用户成功创建一张保单
- **WHEN** `POST /policies` 完成数据库提交
- **THEN** 系统 SHALL 持久化 `policy.created` 事件
- **AND** 事件 payload SHALL 包含 `premium`、`payout`、`flight_id` 与 `delay_rate`

#### Scenario: 合约监听记录证据事件
- **GIVEN** 已登录用户成功创建一张保单
- **WHEN** contract adapter 返回 `contract_ref`
- **THEN** 系统 SHALL 持久化 `contract.watched` 事件
- **AND** 事件 payload SHALL 包含 `contract_ref` 与 adapter mode

#### Scenario: 事件排序稳定
- **GIVEN** 同一张保单存在多条同秒创建的证据事件
- **WHEN** 客户端查询该保单 timeline
- **THEN** 响应 SHALL 按 `created_at ASC, event_sequence ASC, id ASC` 返回事件
- **AND** 同一流程连续写入的事件 SHALL 按写入顺序回放

#### Scenario: 拒绝跨对象证据事件
- **GIVEN** policy `P1` 属于 flight `F1`
- **WHEN** 后端尝试为 `P1` 写入 flight `F2` 的证据事件
- **THEN** 系统 SHALL 拒绝写入
- **AND** 系统 SHALL NOT 持久化该错误关联事件

#### Scenario: 拒绝不匹配 claim 证据事件
- **GIVEN** claim `C1` 属于 policy `P1`
- **WHEN** 后端尝试把 `C1` 作为 policy `P2` 的证据事件写入
- **THEN** 系统 SHALL 拒绝写入
- **AND** 系统 SHALL NOT 持久化该错误关联事件

### Requirement: 赔付证据事件
系统 SHALL 在自动赔付流程中记录观测、条件命中、触发、结算、余额到账与落地确认事件；这些事件 MUST 不改变现有赔付成功与失败语义。

#### Scenario: 延误观测被记录
- **GIVEN** 一张 active policy 被 ClaimEngine 检查
- **WHEN** ClaimEngine 取得 `delay_minutes` 观测值
- **THEN** 系统 SHALL 持久化 `observation.received` 事件
- **AND** 事件 payload SHALL 包含 `delay_minutes` 与 `source`

#### Scenario: 条件命中被记录
- **GIVEN** active policy 的延误观测满足阈值
- **WHEN** ClaimEngine 判定 condition triggered
- **THEN** 系统 SHALL 持久化 `condition.matched` 事件
- **AND** 事件 payload SHALL 包含实际延误分钟数和阈值分钟数

#### Scenario: 赔付结算被记录
- **GIVEN** ClaimEngine 成功创建 claim 并更新用户余额
- **WHEN** 数据库提交前写入证据链
- **THEN** 系统 SHALL 持久化 `claim.triggered`、`claim.settled`、`balance.credited` 与 `flight.landed` 事件
- **AND** `claim.settled` 事件 SHALL 关联 `claim_id`
- **AND** `claim.settled` payload SHALL 包含 `payout`、`signature`、`tx_hash` 与 `settle_duration_ms`

#### Scenario: 未命中条件不记录结算事件
- **GIVEN** active policy 的延误观测小于阈值
- **WHEN** ClaimEngine 完成该 policy 检查
- **THEN** 系统 SHALL NOT 持久化 `condition.matched`、`claim.triggered` 或 `claim.settled` 事件

### Requirement: 证据链查询 API
系统 SHALL 提供按保单和按赔付查询 timeline 的 REST API。普通用户 MUST 只能读取自己保单的证据链；不属于当前用户或不存在的资源 MUST 返回 404。

#### Scenario: 按 policy_id 查询 timeline
- **GIVEN** 当前用户拥有 policy `P1` 且该 policy 有证据事件
- **WHEN** 用户请求 `GET /policies/P1/timeline`
- **THEN** 系统 SHALL 返回 subject 中的 `policy_id`、`flight_id` 和可选 `claim_id`
- **AND** 响应 SHALL 包含该 policy 的有序事件列表

#### Scenario: 按 claim_id 查询 timeline
- **GIVEN** 当前用户拥有 claim `C1` 对应的 policy
- **WHEN** 用户请求 `GET /claims/C1/timeline`
- **THEN** 系统 SHALL 返回与该 claim 所属 policy 相关的完整事件列表
- **AND** subject SHALL 包含 `claim_id`

#### Scenario: 查询其他用户的证据链被隐藏
- **GIVEN** 用户 A 拥有 policy `P1`
- **AND** 用户 B 已登录
- **WHEN** 用户 B 请求 `GET /policies/P1/timeline`
- **THEN** 系统 SHALL 返回 `404 Not Found`
- **AND** 响应 SHALL NOT 暴露该 policy 是否存在

#### Scenario: 无事件资源返回空 timeline
- **GIVEN** 当前用户拥有 policy `P1` 但没有证据事件
- **WHEN** 用户请求 `GET /policies/P1/timeline`
- **THEN** 系统 SHALL 返回空 events 数组
- **AND** 响应 SHALL NOT 返回 500

### Requirement: Evidence Drawer 证据链回放
系统 SHALL 在前端提供 Evidence Drawer，用于按需加载并展示 policy 或 claim timeline。Drawer MUST 使用持久化 API 数据，不得依赖仅存在于前端内存中的 WebSocket event store。

#### Scenario: 从 claim 打开证据链
- **GIVEN** 用户在 Claims Feed 中看到一条赔付记录
- **WHEN** 用户点击该行的 Evidence 操作
- **THEN** Evidence Drawer SHALL 打开
- **AND** 前端 SHALL 请求 `GET /claims/{claim_id}/timeline`
- **AND** Drawer SHALL 渲染 timeline 事件标题、时间、source 与摘要

#### Scenario: 从 policy 打开证据链
- **GIVEN** 用户在 My Hangar 或 Flight Detail 中看到一张保单
- **WHEN** 用户点击该保单的 Evidence 操作
- **THEN** Evidence Drawer SHALL 打开
- **AND** 前端 SHALL 请求 `GET /policies/{policy_id}/timeline`

#### Scenario: 证据链空态
- **GIVEN** timeline API 返回空 events 数组
- **WHEN** Evidence Drawer 渲染
- **THEN** Drawer SHALL 显示空态文案 `No evidence events yet`
- **AND** Drawer SHALL 保持可关闭

#### Scenario: 证据链请求失败
- **GIVEN** timeline API 返回 404 或网络错误
- **WHEN** Evidence Drawer 渲染
- **THEN** Drawer SHALL 显示错误状态
- **AND** Drawer SHALL NOT 关闭当前页面或破坏原有列表导航
