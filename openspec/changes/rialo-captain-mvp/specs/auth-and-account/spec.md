## ADDED Requirements

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

系统 SHALL 提供一个仅开发环境显式开启的 `POST /auth/dev-login` 端点，用于本地 demo 在没有 Google OAuth Client ID 时创建或获取用户并签发同样的 JWT cookie。

#### Scenario: dev login 开启时创建账号
- **GIVEN** `DEV_LOGIN_ENABLED=true`
- **WHEN** 客户端提交 `{email, name}` 到 `POST /auth/dev-login`
- **THEN** 系统创建或获取对应用户，初始化 `balance = 1000`，并返回 JWT cookie

#### Scenario: dev login 关闭时隐藏端点
- **GIVEN** `DEV_LOGIN_ENABLED=false`
- **WHEN** 客户端提交到 `POST /auth/dev-login`
- **THEN** 系统返回 `404 Not Found`，不创建用户，不签发 cookie

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
