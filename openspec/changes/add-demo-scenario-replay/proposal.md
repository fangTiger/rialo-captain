# Change: Demo Scenario Replay Experience

## Why

Rialo-Captain 已经具备 Guided Demo、购买后 Cinema 闭环和 Evidence Drawer，但现场演示仍需要操作者临场串联步骤。需要把这些能力包装为可选择、可重放、可解释的页面交互，让 demo 不依赖真实链上、真实支付、生产登录或多真实数据源能力，也能稳定展示产品故事。

## What Changes

- 在 Tower Guided Demo Rail 中新增 demo scenario picker，支持选择 `Smooth payout`、`At risk flight`、`Evidence deep dive` 等演示场景，并把场景目标、推荐航班和下一步动作展示给操作者。
- 在购买成功后的 `Settlement replay` 步骤中增加 `Replay settlement` 和 `Open evidence story` 操作，用现有本地演示事件链重放 TrailDraw、ShockWave、ChainBeam、FlareLand，不新增或改变后端业务 API。
- 为 Evidence Drawer 增加 story playback 模式，允许按时间线事件逐步播放、高亮当前事件，并提供 `Previous`、`Next`、`Play`、`Pause` 控制。
- 增加 demo-only Copilot prompt chips，引导用户询问当前场景、保单或证据链；Copilot 继续保持只读，不买险、不改保单、不触发赔付。
- 保持 dev login、真实 Copilot provider、本地演示 AI 禁令、现有 BuyDrawer、ClaimEngine、Evidence API、WebSocket 语义不变。

## Impact

- Affected specs: `live-dashboard`, `cinema-engine`, `settlement-evidence`
- Affected frontend: `frontend/src/components/demo/*`, `frontend/src/routes/TowerShell.tsx`, `frontend/src/components/evidence/EvidenceDrawer.tsx`, related tests
- Affected backend: 无预期修改
- Affected tests: Guided Demo director/rail、TowerShell、EvidenceDrawer 相关 Vitest 覆盖；必要时补充 focused browser smoke
- Dependencies: 不新增 runtime dependency
