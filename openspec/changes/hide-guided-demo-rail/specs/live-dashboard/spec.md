## ADDED Requirements

### Requirement: Tower 首页风险预测 HUD 与隐藏式 Guided Demo
系统 SHALL 在 Tower 首页默认隐藏 Guided Demo Rail 和 `Start guide` 入口，使熟悉产品的操作者可直接通过地图、风险预测、购买抽屉和证据链完成演示。系统 MAY 保留显式内部开关以便回归验证 guided demo 状态机，但普通 `/` 首屏 MUST NOT 展示 guide 入口。右侧风险预测 HUD SHALL 不为 guide 预留空位，并在桌面端自然占据右侧信息栏；窄屏端 SHALL 只堆叠 AI Briefing 与风险预测 HUD，不再显示底部 guide rail。

#### Scenario: 默认 Tower 首页隐藏 guide
- **GIVEN** 用户已登录并访问 `/` Tower 首页
- **WHEN** 页面完成首屏渲染
- **THEN** 系统 SHALL NOT 显示 `Start guide`
- **AND** 系统 SHALL NOT 渲染 Guided Demo Rail
- **AND** 系统 SHALL 显示风险预测 HUD

#### Scenario: 右侧风险预测 HUD 不预留 guide 空间
- **GIVEN** 用户在桌面端访问 `/` Tower 首页
- **WHEN** 页面完成首屏渲染
- **THEN** 右侧 HUD SHALL 只包含风险预测面板
- **AND** 右侧 HUD SHALL NOT 使用两行布局为 guide 预留第二行
- **AND** 风险预测面板 SHALL 可在详情展开时自行滚动

#### Scenario: 窄屏端不显示底部 guide rail
- **GIVEN** 用户在窄屏访问 `/` Tower 首页
- **WHEN** 页面完成首屏渲染
- **THEN** 顶部堆叠 SHALL 包含 AI Briefing 与风险预测 HUD
- **AND** 页面 SHALL NOT 渲染底部 Guided Demo Rail
