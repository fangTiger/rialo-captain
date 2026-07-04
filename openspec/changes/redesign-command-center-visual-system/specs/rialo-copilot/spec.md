## ADDED Requirements

### Requirement: Copilot 风控终端化展示
Rialo Copilot 入口、AI Briefing 和 Copilot Panel SHALL 采用 Command Center 风控终端视觉语言，展示真实 provider 状态、上下文来源和引用，同时不得改变鉴权、数据隔离或 DeepSeek provider 行为。

#### Scenario: AI Briefing 与 HUD 统一
- **WHEN** Tower 渲染 AI Briefing
- **THEN** AI Briefing SHALL 与 Risk Intelligence HUD 共享终端化 surface、边框、状态灯、密度和 typography
- **AND** 展开/收起行为 SHALL 保持可访问

#### Scenario: Copilot Panel 展示真实 provider 状态
- **WHEN** 用户打开 Copilot Panel
- **THEN** 面板 SHALL 显示 provider/model 状态或等价真实 AI 状态提示
- **AND** 本地开发配置了 `DEEPSEEK_API_KEY` 时不得展示 fake/mock/offline provider 语义

#### Scenario: Copilot 引用可读
- **WHEN** Copilot 返回 sources
- **THEN** Panel SHALL 以 Command Center 风格展示 flight、policy、claim 和 evidence 引用
- **AND** 点击引用 SHALL 保持现有导航或打开证据行为
