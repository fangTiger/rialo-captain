## ADDED Requirements

### Requirement: Login Command Center 视觉入口
登录页 SHALL 采用与 Tower 一致的 Command Center 风格，作为进入 Rialo 风险指挥台的第一屏。登录页 MUST 保留 `Latch APP` 和 dev login 能力，不得因视觉改造隐藏、关闭或弱化演示阶段 dev login。

#### Scenario: Login 视觉统一
- **WHEN** 用户访问 `/login`
- **THEN** 页面 SHALL 展示电影感雷达背景、Rialo 指挥台语气和清晰登录入口
- **AND** 页面 SHALL 不渲染与产品无关的营销式 hero/card 组合

#### Scenario: Dev login 保持可见
- **GIVEN** `VITE_DEV_LOGIN_ENABLED=true`
- **WHEN** 用户访问 `/login`
- **THEN** `Latch APP` 入口 SHALL 可见
- **AND** 点击后 Dev Login dialog SHALL 可用
- **AND** 提交成功后 SHALL 进入 Tower

#### Scenario: 移动端登录可用
- **WHEN** 用户在移动视口访问 `/login`
- **THEN** 登录入口、`Latch APP`、dialog close 和 submit 控件 SHALL 不重叠
- **AND** 文本 SHALL 不溢出按钮或输入容器
