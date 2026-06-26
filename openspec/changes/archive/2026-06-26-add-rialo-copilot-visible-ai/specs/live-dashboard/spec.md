## ADDED Requirements

### Requirement: 全局 Rialo Copilot 可见入口

系统 SHALL 在除 `/login` 之外的受保护前端路由中显示明显的 `Ask Rialo` AI 入口，并通过全局 Copilot 面板承载问答、引用、追问和错误状态。入口 MUST 不影响现有 SearchPalette 快捷键和页面导航。

#### Scenario: TopNav 显示 Ask Rialo
- **GIVEN** 用户已登录并访问 `/`、`/flight/:id`、`/policies`、`/claims`、`/routes` 或 `/rialo-inside`
- **WHEN** TopNav 渲染
- **THEN** 导航区域显示 `Ask Rialo` 入口
- **AND** 入口视觉上与普通导航 tab 区分，明确表达 AI 能力

#### Scenario: 点击 Ask Rialo 打开全局面板
- **GIVEN** 用户已登录并看到 `Ask Rialo`
- **WHEN** 用户点击入口
- **THEN** Rialo Copilot 面板打开
- **AND** 面板提供问题输入框、推荐问题、回答区域和来源引用区域
- **AND** 当前路由不改变

#### Scenario: Login 页面不显示 AI 入口
- **GIVEN** 用户访问 `/login`
- **WHEN** 页面渲染
- **THEN** TopNav 未渲染
- **AND** 不显示 `Ask Rialo` 或 Copilot 面板

### Requirement: Tower 首页 AI Briefing

系统 SHALL 在 Tower 首页首屏显示 AI Briefing 模块，让用户登录后立即看到 Rialo Copilot 能力。模块 MUST 展示当前账户或市场上下文的简短 AI 引导和可点击 prompt chips。

#### Scenario: Tower 首页展示 AI Briefing
- **GIVEN** 用户已登录并访问 `/`
- **WHEN** TowerShell 首屏渲染
- **THEN** 页面显示 `AI Briefing` 模块
- **AND** 模块包含至少 3 个 prompt chips
- **AND** prompt chips 可一键打开 Copilot 面板并提交对应问题

#### Scenario: AI provider 未配置时 Briefing 降级
- **GIVEN** 用户已登录但后端 Copilot 返回 unavailable
- **WHEN** 用户点击 AI Briefing 的 prompt chip
- **THEN** Copilot 面板展示“AI 暂未接通”的可理解状态
- **AND** Tower 大屏和其他数据组件继续正常显示

### Requirement: 上下文 prompt chips

系统 SHALL 在 FlightDetail、MyHangar、ClaimsFeed 和 EvidenceDrawer 中展示与当前对象相关的 Copilot prompt chips。点击 chip MUST 自动携带 subject 类型与 subject id，使回答基于当前对象。

#### Scenario: FlightDetail 提供航班上下文问题
- **GIVEN** 用户访问 `/flight/:id`
- **WHEN** FlightDetail 渲染
- **THEN** 页面展示至少 2 个航班相关 prompt chips
- **AND** 点击 chip 以 `subject_type="flight"` 和当前 `flight_id` 调用 Copilot

#### Scenario: ClaimsFeed 提供赔付解释问题
- **GIVEN** 用户访问 `/claims` 并看到赔付记录
- **WHEN** 用户点击某条 claim 的 AI prompt chip
- **THEN** Copilot 面板打开
- **AND** 以 `subject_type="claim"` 和该 `claim_id` 调用 Copilot

#### Scenario: EvidenceDrawer 提供证据链问题
- **GIVEN** 用户打开某条赔付的 EvidenceDrawer
- **WHEN** 抽屉渲染
- **THEN** 抽屉显示证据链解释 prompt chip
- **AND** 点击 chip 后 Copilot 回答包含来源引用区域
