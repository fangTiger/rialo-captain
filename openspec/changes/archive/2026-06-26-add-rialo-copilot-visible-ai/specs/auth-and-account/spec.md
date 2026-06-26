## ADDED Requirements

### Requirement: Copilot 鉴权与用户数据隔离

系统 SHALL 对所有 Copilot REST 端点执行与现有受保护端点一致的 JWT cookie 鉴权，并在 subject 级别校验当前用户是否可访问对应 policy、claim 或 evidence 数据。Copilot MUST NOT 读取或返回其他用户的私有保单、赔付、余额或身份信息。

#### Scenario: 已登录用户访问自己的 Copilot 上下文
- **GIVEN** 用户已登录并拥有一份 policy
- **WHEN** 用户以该 `policy_id` 调用 `POST /copilot/ask`
- **THEN** 后端允许请求继续处理
- **AND** 上下文中可以包含该 policy 的摘要

#### Scenario: 未登录用户访问 Copilot 被拒
- **GIVEN** 请求未携带合法 JWT cookie
- **WHEN** 调用 `POST /copilot/ask`
- **THEN** 后端返回 `401 Unauthorized`
- **AND** 不构建上下文，不调用 DeepSeek

#### Scenario: 用户不能读取他人私有 subject
- **GIVEN** 用户 A 已登录
- **AND** 用户 B 拥有一份 policy 或 claim
- **WHEN** 用户 A 以用户 B 的 subject id 调用 `POST /copilot/ask`
- **THEN** 后端拒绝请求
- **AND** DeepSeek 请求体中不包含用户 B 的数据
