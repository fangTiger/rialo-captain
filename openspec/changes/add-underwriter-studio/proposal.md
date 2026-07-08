## Why

Rialo-Captain 目前已经完成实时航班投保、延误触发、自动赔付、证据链和 Tower 可视化闭环，但用户只能作为投保人观察系统承保结果，不能亲自定义反应式承保规则并承担/获得池子损益。Underwriter Studio 将任意登录用户升级为承保人，让 demo 从“我买保险并看见赔付”扩展为“我开池、系统自动匹配乘客保单、实时航班触发后从我的池子赔付”的完整反应式承保闭环。

## What Changes

- 新增 Underwriter Studio `/studio` 体验：三张 preset 卡、一句话规则 chip、stake slider、active pool KPI、event ticker、Close Pool 和仅 dev login 可见的 `Inject demo delay`。
- 新增 `backend/pools/` 后端能力，覆盖 pool 数据模型、单用户单活跃池约束、规则 matcher、池服务、REST API、timeline、Passenger Simulator 和 SYSTEM_SIM_USER。
- 扩展现有 Policy/Claim 流：Simulator 通过现有 policy 创建路径造单，匹配成功的 policy 绑定 `underwriter_pool_id`；ClaimEngine 对绑定 policy 从 pool balance 扣款，破产时关闭池但保留已绑活跃 policy 跑完。
- 扩展 WebSocket 和航班 payload：广播 `pool.opened`、`pool.policy_bound`、`pool.claim_paid`、`pool.rule_updated`、`pool.closed`，并为 Tower flight dot 提供 `underwritten_by_pool_id` 与绿色 FLARE 联动。
- 扩展前端 store/API/components/Nav/Tower/Copilot：使用现有 `tokens.css` 命令中心视觉，不引入新配色或字体；所有用户可见文案为英文；Copilot 复用 `/copilot/ask/stream` 注入 pool 上下文。
- 不引入独立 feature flag；唯一后端开关为 `POOL_SIMULATOR_ENABLED`，默认开启。

## Capabilities

### New Capabilities

- `underwriter-studio`: 定义用户承保池、规则匹配、Simulator 自动客流、池余额赔付、Studio UI、Tower 联动和 Copilot briefing。

### Modified Capabilities

- `reactive-insurance-core`: 自动赔付流程需要识别已绑定 pool 的 policy，并从承保池扣款与广播 pool 赔付事件。
- `live-dashboard`: Tower 需要展示当前用户承保航班绿点、claim FLARE 和 STUDIO nav badge。
- `rialo-copilot`: Copilot overview/Studio briefing 需要读取当前 pool、绑定 policy、claim 和损益上下文。
- `auth-and-account`: SYSTEM_SIM_USER 必须是隐藏系统账号，不可登录、不可出现在 leaderboard，并且 dev login 能力保持可见可用。

## Impact

- Affected specs: `underwriter-studio`, `reactive-insurance-core`, `live-dashboard`, `rialo-copilot`, `auth-and-account`
- Affected backend: `backend/models.py`, `backend/db.py`, `backend/config.py`, `backend/app.py`, `backend/policies/service.py`, `backend/policies/routes.py`, `backend/claims/engine.py`, `backend/ws/broadcaster.py`, `backend/flights/routes.py`, `backend/copilot/*`, 新增 `backend/pools/*`
- Affected frontend: `frontend/src/App.tsx`, `frontend/src/api/pool.ts`, `frontend/src/store/pool.ts`, `frontend/src/routes/StudioShell.tsx`, `frontend/src/components/studio/*`, `frontend/src/components/shell/TopNav.tsx`, `frontend/src/components/tower/GlobeMap.tsx`, `frontend/src/components/tower/GlobeMap.css`, `frontend/src/hooks/useWebSocket.ts`, `frontend/src/api/copilot.ts`, Copilot 相关组件
- Affected tests: backend pools/matcher/service/routes/simulator/claim-engine tests, frontend store/api/component/route/nav/tower/copilot Vitest tests, Playwright `studio-open-to-first-bind` 与 `studio-inject-payout`
- Security notes: 普通用户只能读取/修改自己的 active pool；SYSTEM_SIM_USER 不可登录；dev inject 按钮仅在 `DEV_LOGIN_ENABLED=true`/`VITE_DEV_LOGIN_ENABLED=true` 相关开发配置下可见；不得弱化 dev login 或本地真实 AI provider 要求。
