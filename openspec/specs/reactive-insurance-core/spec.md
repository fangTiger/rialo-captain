# reactive-insurance-core Specification

## Purpose
TBD - created by archiving change rialo-captain-mvp. Update Purpose after archive.
## Requirements
### Requirement: ReactiveContractAdapter 抽象接口

系统 SHALL 提供 `ReactiveContractAdapter` Python Protocol，所有保险业务代码 MUST 仅依赖该接口，不直接依赖任何具体实现。

#### Scenario: Mock 实现可注册
- **GIVEN** 配置 `RIALO_MODE=mock`
- **WHEN** 系统启动
- **THEN** `get_contract_adapter()` 返回 `MockRialoAdapter` 实例

#### Scenario: Real 实现可注册但暂未实现
- **GIVEN** 配置 `RIALO_MODE=real`
- **WHEN** 调用任何 adapter 方法
- **THEN** 抛出 `NotImplementedError("Awaiting Rialo SDK release")`

#### Scenario: 业务代码与具体实现解耦
- **GIVEN** PolicyService / ClaimEngine 任意代码
- **WHEN** 静态扫描 import
- **THEN** 仅出现 `from backend.contracts.base import ...`，不出现 `MockRialoAdapter` 或 `RealRialoAdapter`

### Requirement: 反应式自动赔付循环

系统 SHALL 通过 asyncio 后台循环，每 30 秒检查所有 `active` 状态的 policy，触发条件满足时自动结算并广播 FLARE 事件。

#### Scenario: 延误满足阈值触发赔付
- **GIVEN** 一份 active policy，其关联航班的 `actual_arrival` > `scheduled_arrival + 30 min`
- **WHEN** 后台循环检测到该状态
- **THEN** 自动创建 `claims` 记录、更新用户 `balance`、policy 状态变为 `paid`、广播 WS FLARE 事件

#### Scenario: 单个 policy 触发失败不影响其它
- **GIVEN** 同一轮循环中有 3 份 policy，policy_2 触发时抛异常
- **WHEN** 循环结束
- **THEN** policy_1 和 policy_3 正常处理，policy_2 写入 `failed_triggers` 表，循环不中断

#### Scenario: 结算延时被记录
- **GIVEN** 一份 policy 从检测到状态变化到 claim 写库完成
- **WHEN** claim 创建完成
- **THEN** `claims.settle_duration_ms` 字段记录端到端用时（用于 Claims Feed 展示）

### Requirement: 航班延误险产品

系统 SHALL 提供延误险产品，保费档位固定 5/10/20 RIA，赔付倍率基于航线历史延误率反向计算。

#### Scenario: 高延误率航线倍率低
- **GIVEN** 航线历史 30 天延误率 ≥ 40%
- **WHEN** 用户买 10 RIA 保单
- **THEN** `payout = 2.5x * premium = 25 RIA`

#### Scenario: 低延误率航线倍率高
- **GIVEN** 航线历史 30 天延误率 ≤ 5%
- **WHEN** 用户买 10 RIA 保单
- **THEN** `payout = 8x * premium = 80 RIA`（低概率事件赔付高，符合保险定价）

#### Scenario: 保费档位限制
- **GIVEN** 用户尝试创建一份 7 RIA 保单
- **WHEN** 提交 `POST /policies` 带 `premium=7`
- **THEN** 返回 `422 Unprocessable Entity`，提示档位只能是 5/10/20

### Requirement: 模拟链上签名

系统 SHALL 为每笔赔付生成 `sha256(policy_id + timestamp + nonce)` 的 64-hex 签名串，前端展示用。

#### Scenario: 签名格式
- **GIVEN** 一笔已赔付的 claim
- **WHEN** `GET /claims/recent`
- **THEN** 每条记录的 `signature` 字段为 `0x` 开头 + 64 个 hex 字符

#### Scenario: 签名可重现性
- **GIVEN** 同一组 `policy_id`、`timestamp`、`nonce`
- **WHEN** 重新生成签名
- **THEN** 输出完全一致（确定性，便于测试）

### Requirement: Admin 注入模拟延误

系统 SHALL 提供受保护的 admin endpoint，允许在演示时手动触发某航班"延误"，用于现场演示反应式赔付。

#### Scenario: 注入延误触发赔付
- **GIVEN** 一份 active policy + admin token
- **WHEN** `POST /admin/inject-delay { flight_id, delay_minutes: 45 }`
- **THEN** 后台循环下一轮会判定该航班"已延误 45 min"，自动赔付该 policy

#### Scenario: 未授权 admin 调用被拒
- **GIVEN** 未携带 admin token 的请求
- **WHEN** `POST /admin/inject-delay`
- **THEN** 返回 `403 Forbidden`

### Requirement: 自动赔付流程写入证据链
系统 SHALL 在不改变现有反应式赔付语义的前提下，为 ClaimEngine 处理的每张 policy 写入 settlement-evidence 证据事件。证据写入失败 MUST NOT 使本来已经成功的赔付回滚，且 MUST 被记录为后端错误日志。

#### Scenario: 成功赔付写入完整证据链
- **GIVEN** 一份 active policy 的延误条件被命中
- **WHEN** ClaimEngine 自动创建 claim、更新余额并广播事件
- **THEN** 系统 SHALL 为该 policy 写入观测、条件命中、触发、结算、余额到账和落地确认事件
- **AND** 现有 claim 记录、policy paid 状态、用户余额和 WebSocket 广播 SHALL 保持不变

#### Scenario: 未命中条件只记录观测
- **GIVEN** 一份 active policy 的延误条件未命中
- **WHEN** ClaimEngine 完成检查
- **THEN** 系统 MAY 写入 `observation.received` 事件
- **AND** 系统 SHALL NOT 写入结算类证据事件
- **AND** policy SHALL 保持 `active`

#### Scenario: 证据写入失败不阻塞赔付
- **GIVEN** ClaimEngine 已经成功从 adapter 获取结算结果
- **AND** 证据事件写入出现异常
- **WHEN** ClaimEngine 完成该 policy 的处理
- **THEN** 系统 SHALL 优先保证 claim 创建、用户余额增加和 policy 状态更新
- **AND** 系统 SHALL 记录中文错误日志
- **AND** 同一轮其它 policy SHALL 继续处理
