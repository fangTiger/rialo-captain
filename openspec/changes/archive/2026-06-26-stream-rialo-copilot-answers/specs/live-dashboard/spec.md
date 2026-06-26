## ADDED Requirements

### Requirement: Copilot 可读取 Tower 实时航班摘要

系统 SHALL 为 Rialo Copilot overview 构建 Tower 实时航班摘要，使 AI 能解释当前地图上的 live flights，同时不暴露 DeepSeek key、原始 provider 响应或其他用户的私有保单/赔付数据。发送给 DeepSeek 的 live flight 样本 MUST 最多包含 5 条。

#### Scenario: overview 包含 live tower 摘要
- **GIVEN** Tower live cache 中存在航班状态
- **WHEN** 已登录用户以 `subject_type="overview"` 提交 Copilot 问题
- **THEN** Copilot 上下文包含 live tower 总航班数
- **AND** 包含数据是否 stale 与 stale seconds
- **AND** 包含最多 5 条 sample flights
- **AND** 不包含 DeepSeek API key 或前端不可见的 provider 机密

#### Scenario: 未买保单用户仍看到 live flights 语义
- **GIVEN** 用户已登录但没有 policies、claims 或 evidence events
- **AND** Tower live cache 中存在航班状态
- **WHEN** 用户询问“现在有什么值得关注”
- **THEN** Copilot 回答 MUST 明确说明用户当前没有承保敞口
- **AND** MUST 同时说明 Tower 正在跟踪 live flights
- **AND** MUST NOT 回答“当前没有航班”

#### Scenario: live sample flights 最多 5 条
- **GIVEN** Tower live cache 中存在超过 100 条航班状态
- **WHEN** Copilot 构建 overview 上下文
- **THEN** 上下文只包含最多 5 条 sample flights
- **AND** sample flights 优先选择命名 demo 航班、有 DB route 信息或当前页面高可见度航班
- **AND** 不把完整 live cache 原样发送给 DeepSeek

#### Scenario: live cache 缺失时安全降级
- **GIVEN** Tower live cache 为空或 flight fetcher 尚未写入数据
- **WHEN** 用户提交 overview Copilot 问题
- **THEN** Copilot 仍基于当前用户 policies、claims 和 evidence events 回答
- **AND** 上下文标记 live tower 数据不可用
- **AND** 前端页面不因 Copilot 上下文缺失而报错
