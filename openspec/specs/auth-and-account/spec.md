# auth-and-account Specification

## Purpose
TBD - created by archiving change rialo-captain-mvp. Update Purpose after archive.
## Requirements
### Requirement: Google OAuth 登录

系统 SHALL 在生产环境使用 Google OAuth 作为正式登录方式，校验 Google 颁发的 ID token 后签发 HttpOnly JWT cookie。cookie 的 `Secure` 属性 SHALL 由环境配置控制，本地 HTTP 开发默认关闭，生产 HTTPS 部署开启。

#### Scenario: 首次登录自动创建账号
- **GIVEN** 一个未注册的用户提供合法的 Google ID token
- **WHEN** 提交到 `POST /auth/google`
- **THEN** 系统创建 `users` 记录（含 `google_sub`、`email`、`name`、`avatar_url`），初始化 `balance = 1000`，返回 JWT cookie

#### Scenario: 已注册用户登录
- **GIVEN** 一个已存在 `google_sub` 的用户提供合法 ID token
- **WHEN** 提交到 `POST /auth/google`
- **THEN** 系统返回 JWT cookie，不重置余额，不重置头像/邮箱

#### Scenario: 非法 ID token 被拒绝
- **GIVEN** 一个伪造、过期或来自非授权 client_id 的 ID token
- **WHEN** 提交到 `POST /auth/google`
- **THEN** 返回 `401 Unauthorized`，不创建任何记录，不签发 cookie

#### Scenario: 本地 HTTP 开发允许写入 cookie
- **GIVEN** `COOKIE_SECURE=false`
- **WHEN** 用户通过合法 Google ID token 登录
- **THEN** 系统签发不带 `Secure` 属性的 HttpOnly JWT cookie，允许 `http://localhost` 浏览器会话持有登录态

#### Scenario: 生产 HTTPS 部署使用 Secure cookie
- **GIVEN** `COOKIE_SECURE=true`
- **WHEN** 用户通过合法 Google ID token 登录
- **THEN** 系统签发带 `Secure` 属性的 HttpOnly JWT cookie

### Requirement: 开发环境 fake login

系统 SHALL 提供一个仅开发环境显式开启的 `POST /auth/dev-login` 端点，用于本地 demo 在没有 Google OAuth Client ID 时创建或获取用户并签发同样的 JWT cookie。前端登录首页 SHALL 将 dev login 作为右上角 `Latch APP` 入口触发的 DEV 操作面板展示，默认不直接暴露表单。

#### Scenario: dev login 开启时创建账号
- **GIVEN** `DEV_LOGIN_ENABLED=true`
- **WHEN** 客户端提交 `{email, name}` 到 `POST /auth/dev-login`
- **THEN** 系统创建或获取对应用户，初始化 `balance = 1000`，并返回 JWT cookie

#### Scenario: dev login 关闭时隐藏端点
- **GIVEN** `DEV_LOGIN_ENABLED=false`
- **WHEN** 客户端提交到 `POST /auth/dev-login`
- **THEN** 系统返回 `404 Not Found`，不创建用户，不签发 cookie

#### Scenario: 登录首页以 Tower 风格展示 DEV 入口
- **GIVEN** `VITE_DEV_LOGIN_ENABLED=true`
- **WHEN** 用户访问 `/login`
- **THEN** 页面使用与 Tower 一致的暗色雷达视觉系统
- **AND** 右上角显示 `Latch APP` 入口
- **AND** DEV 登录表单默认隐藏

#### Scenario: 点击 Latch APP 打开 DEV 操作面板
- **GIVEN** `VITE_DEV_LOGIN_ENABLED=true` 且用户在 `/login`
- **WHEN** 用户点击 `Latch APP`
- **THEN** DEV 登录面板以可访问的 dialog 形式出现
- **AND** `Latch APP` 的 `aria-expanded` 反映打开状态
- **AND** 用户仍可提交 email 完成 dev login 并进入 Tower

### Requirement: JWT cookie 鉴权

系统 SHALL 通过 HttpOnly cookie 中的 JWT 鉴权所有需登录的 REST 和 WebSocket 端点，签名密钥与 cookie 安全属性可配置。

#### Scenario: 登录后访问 /me
- **GIVEN** 用户已通过 OAuth 登录、浏览器持有 JWT cookie
- **WHEN** 请求 `GET /me`
- **THEN** 返回 `{id, email, name, avatar_url, balance}`

#### Scenario: 未登录访问受保护端点
- **GIVEN** 请求未携带合法 JWT cookie
- **WHEN** 访问 `GET /policies` 或 `POST /policies` 或 `WS /ws`
- **THEN** 返回 `401`（REST）或拒绝 upgrade（WS）

### Requirement: 模拟 RIA 积分账户

系统 SHALL 为每个用户维护整数 `balance`（单位 RIA），初始 1000，用于买险扣款与赔付到账。

#### Scenario: 买险扣款
- **GIVEN** 用户余额 1000 RIA
- **WHEN** 创建一份 5 RIA 保单
- **THEN** 余额变为 995

#### Scenario: 赔付到账
- **GIVEN** 用户持有一份赔付额 20 RIA 的有效保单
- **WHEN** 触发自动赔付
- **THEN** 余额增加 20 RIA、policy 状态变为 `paid`

#### Scenario: 余额不足拒绝买险
- **GIVEN** 用户余额 3 RIA
- **WHEN** 尝试创建一份 5 RIA 保单
- **THEN** 返回 `402 Payment Required`，余额不变，无 policy 记录

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
