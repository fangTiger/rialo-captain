## ADDED Requirements

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
