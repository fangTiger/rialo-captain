## 1. 设计系统底座

- [x] 1.1 扩展 `frontend/src/design/tokens.css`，加入 Command Center 色彩、surface、glow、risk level、motion、scanline、字体尺度和响应式 token
- [x] 1.2 梳理并新增轻量共享样式/组件，覆盖 CommandPanel、MetricDeck、SignalPill、DivergenceMeter、RiskTicker 等可复用模式
- [x] 1.3 为 reduced-motion、pointer-events、focus state、移动端 safe area 补齐全站样式约束
- [x] 1.4 添加或更新设计系统相关测试，验证核心 token/class 在应用入口可用且不破坏现有布局

## 2. Tower 天气与预测主视觉

- [x] 2.1 重做 GlobeMap 天气视觉层，加入 storm mass、severe cell pulse、forecast band、active corridor 和 intercept marker
- [x] 2.2 升级 Risk Intelligence HUD，展示 market odds、model probability、divergence meter、confidence、forecast window 和 signal-only 边界
- [x] 2.3 增加 odds ticker 或 compact watchlist，展示多航班 callsign、probability/odds、方向和压力提示
- [x] 2.4 更新 Tower 相关测试，验证天气层、预测 HUD、ticker 不触发购买、Copilot、路由变化或 CinemaProvider 重挂载

## 3. 全站核心页面迁移

- [x] 3.1 将 Login、TopNav、StatusBar、Search 和 Toast 迁移到 Command Center 视觉语言，并保留 `Latch APP` 与 dev login
- [x] 3.2 将 BuyDrawer 和 EvidenceDrawer 迁移到终端化信息面板，保留购买、证据、关闭、滚动和引用行为
- [x] 3.3 将 Copilot 入口、AI Briefing 和 Copilot Panel 迁移到风控终端风格，展示真实 provider/model 状态和可读 sources
- [x] 3.4 将 My Hangar、Flight Detail、Claims Feed、Hot Routes 和 Rialo Inside 迁移到高密度风险指挥台布局

## 4. 测试与可视化验证

- [x] 4.1 按 TDD 更新 focused frontend tests，覆盖 Login、Tower、Risk HUD、Evidence、Copilot、Hangar、Flight Detail 和 Claims Feed
- [x] 4.2 运行 `pnpm test` 覆盖受影响前端测试，并修复失败用例
- [x] 4.3 运行 `pnpm build`，确保生产构建通过
- [x] 4.4 运行 Playwright desktop/mobile visual smoke，检查 Tower、Login、Hangar、Flight Detail、Evidence、Copilot 无重叠、无空白、交互可用
- [x] 4.5 验证本地 dev login 可见且 `/auth/dev-login` 可用，验证 `/copilot/ask` 使用真实 provider 返回非 unavailable 响应

## 5. 规范收口

- [x] 5.1 运行 `openspec validate redesign-command-center-visual-system --strict --no-interactive`
- [x] 5.2 运行 graphify 重建命令，保持 `graphify-out/` 与代码一致
- [x] 5.3 对照 spec delta 检查每个 Requirement 和 Scenario 是否已实现，并同步勾选本任务清单
