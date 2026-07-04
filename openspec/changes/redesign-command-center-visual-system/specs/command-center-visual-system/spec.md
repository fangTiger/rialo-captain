## ADDED Requirements

### Requirement: 全站 Command Center 视觉系统
系统 SHALL 提供统一的 Command Center 视觉系统，用于 Rialo 所有前端页面和核心组件。视觉系统 MUST 同时支持电影感航空雷达背景和专业风控终端信息面板，并通过共享 tokens、CSS class 或轻量组件复用，而不是在各页面重复手写无关样式。

#### Scenario: 共享视觉 tokens 可用
- **WHEN** 前端应用加载
- **THEN** 全站可使用统一的深色背景、雷达绿、天气青、风险琥珀、严重红、边框、glow、surface、字体尺度和 motion token
- **AND** 核心页面不得各自定义互相冲突的一次性主色板

#### Scenario: 页面风格一致
- **WHEN** 用户在 Tower、Login、My Hangar、Flight Detail、Claims Feed、Copilot、Evidence 和 Buy Drawer 之间切换
- **THEN** 页面 SHALL 保持同一 Command Center 视觉语言
- **AND** 用户 SHALL 能识别它们属于同一个风险指挥台产品

### Requirement: 视觉层不得破坏交互与可访问性
系统 SHALL 保证新增视觉效果、天气层、扫描线、glow、背景纹理和 HUD 装饰不阻挡主交互，不造成文字溢出，并尊重 reduced-motion 偏好。

#### Scenario: 装饰层不拦截交互
- **WHEN** 用户点击地图飞机、列表卡片、抽屉按钮、搜索结果或 Copilot 输入
- **THEN** 装饰性 SVG、背景和气氛层 SHALL 不拦截 pointer events

#### Scenario: Reduced motion
- **GIVEN** 用户系统偏好 `prefers-reduced-motion: reduce`
- **WHEN** 应用渲染 Command Center 视觉效果
- **THEN** 扫描、脉冲、ticker、bloom 和天气流动动效 SHALL 停止或显著降低
- **AND** 关键信息仍通过静态颜色、标签和布局可读

#### Scenario: 移动端无重叠
- **WHEN** 用户在 390px 宽度移动视口访问核心页面
- **THEN** 关键按钮、HUD、抽屉、列表和正文 SHALL 不出现不可读重叠
- **AND** 文本 SHALL 不溢出其按钮或卡片容器
