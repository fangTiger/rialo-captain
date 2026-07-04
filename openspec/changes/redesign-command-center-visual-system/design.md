## Context

Rialo 已经有一套功能完整的演示产品：Tower 大屏、天气/预测信号、购买抽屉、Hangar、Flight Detail、Evidence、Claims、Copilot、Login 与 Guided Demo。当前视觉的问题不是“缺组件”，而是组件之间气质不够统一：Tower 有电影感，列表页更像普通 SaaS，预测 HUD 信息密度不足，Evidence/Copilot 还没有足够强的风控终端质感。

用户明确认可概念图里的两种方向：A 是电影感航空雷达，B 是专业风控终端。本设计采用混合方案：Tower 和登录首屏使用 A 的冲击力，所有可读信息面板、抽屉、证据、Copilot、Hangar、Flight Detail 使用 B 的高密度可信表达。

## Goals / Non-Goals

**Goals:**
- 建立全站 Command Center 视觉系统，让 Rialo 看起来像一个实时航空风险指挥台。
- 让天气风险更炫酷且更直观：storm mass、severe pulse、corridor intercept、weather contribution、forecast freshness。
- 让预测模块更可信：market/model divergence meter、odds ticker、confidence、weather contribution、signal-only 边界。
- 统一全站核心页面和组件：Tower、Login、TopNav、Search、StatusBar、Toast、Hangar、FlightDetail、ClaimsFeed、BuyDrawer、EvidenceDrawer、Copilot。
- 保留现有行为与安全边界：dev login、真实 AI provider、购买/赔付/证据/Copilot 权限不被视觉改造改变。

**Non-Goals:**
- 不接入真实天气或真实预测市场 provider。
- 不新增后端数据模型或修改 ClaimEngine 结算规则。
- 不关闭、隐藏或弱化 dev login。
- 不把预测市场做成可交易产品；仍是只读 signal。
- 不以大面积第三方可视化库替代现有 React/CSS/SVG 架构。

## Decisions

### 1. 采用 “Cinematic Radar + Quant HUD” 混合风格

Tower、Login 和主背景承担第一眼冲击力：深色世界雷达、动态 storm mass、红/琥珀 severe cell、航线截击点、雷达扫描与局部 bloom。信息面板采用风控终端语言：紧凑网格、分歧仪表、ticker、置信度、时间窗、信号来源和证据链。

备选方案 A：全站电影化。优点是惊艳，缺点是信息页容易变成装饰过量。
备选方案 B：全站终端化。优点是专业，缺点是 demo 第一眼不够炸。
选择混合方案，因为 Rialo 同时需要发布会式吸引力和金融/保险产品可信度。

### 2. 先建设计系统底座，再逐页替换

先扩展 `frontend/src/design/tokens.css` 和共享 shell 样式，定义颜色、surface、border、glow、scanline、risk level、motion、spacing、字体尺度和响应式层级。再逐步迁移页面，避免每个组件手写一套效果。

实现中可以新增轻量 class 工具或共享组件，例如 `CommandPanel`、`MetricDeck`、`SignalPill`、`DivergenceMeter`、`RiskTicker`，但不引入重型 UI 框架。

### 3. Tower 是视觉锚点

Tower 改造优先级最高：天气层增加 storm mass、severe pulse、corridor intercept marker、weather contribution label；RiskIntelligencePanel 增加 divergence meter、odds ticker、weather contribution 和 active subject confidence。地图 hit testing、CinemaProvider 生命周期、BuyDrawer 行为必须保持不变。

### 4. 全站信息页走“终端式可信密度”

My Hangar、FlightDetail、ClaimsFeed、EvidenceDrawer、BuyDrawer、Copilot 面板需要统一为深色高密度面板，但不能变成纯表格。每个页面都要有一个清晰主维度：Hangar 看敞口，FlightDetail 看单航班风险，Evidence 看结算路径，Copilot 看解释和引用，BuyDrawer 看购买决策。

### 5. 响应式和可访问性不是后补

移动端必须避免 HUD 互相遮挡。动画必须遵守 `prefers-reduced-motion`。关键交互继续有 keyboard/focus 状态。文字不得溢出按钮、卡片和抽屉。天气层与视觉装饰不得拦截地图、列表或抽屉点击。

## Risks / Trade-offs

- [Risk] 全站视觉改造范围大，容易一次性破坏太多测试 → Mitigation: 分阶段 TDD，每阶段只改一组页面和 focused tests。
- [Risk] 视觉过炫导致信息不清楚 → Mitigation: Tower 背景可以电影化，数据面板必须终端化；所有关键指标保留文本解释。
- [Risk] 动画和 blur 影响性能 → Mitigation: 优先 CSS/SVG，控制 filter 数量，移动端降低层数，reduced motion 禁用关键动画。
- [Risk] 移动端遮挡主流程 → Mitigation: 每阶段做 desktop/mobile Playwright 截图检查，明确 HUD stack 和 drawer safe area。
- [Risk] 用户误以为天气/市场影响赔付 → Mitigation: 所有预测/天气 UI 保留 signal-only copy，Evidence 仍以实际延误和合约事件为事实来源。
- [Risk] dev login 或真实 Copilot 被视觉改造弱化 → Mitigation: 登录和 Copilot 阶段必须保留现有测试，并新增可见性/状态断言。

## Migration Plan

1. 扩展 design tokens 和共享 Command Center primitives。
2. 重做 Tower 天气/预测体验，形成视觉标杆。
3. 迁移 TopNav、StatusBar、Search、Toast、Login 到同一语言。
4. 迁移 BuyDrawer、EvidenceDrawer、Copilot 面板。
5. 迁移 My Hangar、FlightDetail、ClaimsFeed、HotRoutes、RialoInside。
6. 跑 focused tests、frontend build、OpenSpec validate、Playwright desktop/mobile visual smoke。

Rollback 策略：每阶段保持独立提交点；若某个页面视觉回归严重，可回退对应页面样式与共享 primitive 使用，不影响后端行为。

## Open Questions

- 最终主风格比例建议为 A 60% / B 40%；如果用户更偏发布会冲击力，可把 Tower 和 Login 继续加重电影感。
- 是否需要把概念图作为 `docs/design/` 参考资产归档，待用户确认。
