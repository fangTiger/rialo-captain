## MODIFIED Requirements

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
