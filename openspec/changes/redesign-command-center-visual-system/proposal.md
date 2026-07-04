## Why

Rialo 当前已经具备实时航班、天气风险、预测信号、赔付证据和 Copilot，但整体视觉仍像多个功能模块叠加，缺少一套能贯穿全站的“航空风险指挥中心”语言。用户明确偏好概念图里的电影雷达与专业风控终端质感，因此现在应把它升级为全站级产品体验，而不是继续做局部补丁。

## What Changes

- 建立全站 Command Center 视觉系统：电影雷达背景、风控终端面板、统一色阶、边框、发光、动效、密度和响应式规则。
- Tower 首页升级为主视觉场景：天气风险层更震撼、更直观，预测市场 HUD 更像可解释的风控仪表，而非孤立数字。
- 登录页、TopNav、状态条、搜索、Toast、AI Briefing、Copilot 面板、BuyDrawer、EvidenceDrawer、My Hangar、Flight Detail、Claims Feed 等核心界面统一到同一视觉语言。
- 增加更多风险维度表达：天气压力、市场分歧、模型置信度、敞口、赔付路径、证据完整性、航线热度、实时状态、新鲜度和演示场景状态。
- 保留现有产品边界：dev login 不得隐藏或弱化；本地 Copilot 继续使用真实 provider；天气/市场信号仍为只读上下文，不改变购买、赔付、证据或 ClaimEngine 逻辑。
- 不引入会削弱性能或可维护性的重型可视化依赖；优先使用现有 React/CSS/SVG 和已有组件边界。

## Capabilities

### New Capabilities
- `command-center-visual-system`: 定义 Rialo 全站视觉系统、信息密度、动效、可访问性、响应式和跨页面一致性要求。

### Modified Capabilities
- `live-dashboard`: Tower、My Hangar、Flight Detail 和核心运营面板需要以 Command Center 风格展示天气、预测、风险和持仓维度。
- `auth-and-account`: 登录体验需要采用同一视觉语言，同时保留 `Latch APP` / `Dev Login` 入口。
- `rialo-copilot`: Copilot 入口、AI Briefing 和 Copilot 面板需要融入风控终端风格，并继续展示真实 provider 状态。
- `settlement-evidence`: Evidence Drawer 和证据时间线需要升级为更清晰的结算路径/证据完整性界面，但不得改变证据事实来源。

## Impact

- Affected frontend: `frontend/src/design/tokens.css`, `frontend/src/App.tsx`, `frontend/src/components/shell/*`, `frontend/src/routes/*`, `frontend/src/components/tower/*`, `frontend/src/components/copilot/*`, `frontend/src/components/drawer/*`, `frontend/src/components/evidence/*`, `frontend/src/components/hangar/*`, `frontend/src/components/flight/*`, `frontend/src/components/claims/*`, search/toast/status components, and related tests.
- Affected specs: new `command-center-visual-system`; deltas for `live-dashboard`, `auth-and-account`, `rialo-copilot`, and `settlement-evidence`.
- Affected backend: none expected for visual system MVP; backend contracts stay stable.
- Dependencies: no new runtime dependency expected unless implementation reveals a clear need and receives explicit approval.
- Risks: broad visual churn, mobile overlap, animation performance, accessibility regressions, and accidental weakening of dev login / real Copilot / settlement boundaries.
