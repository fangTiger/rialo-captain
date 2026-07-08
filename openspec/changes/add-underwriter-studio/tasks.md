## 1. 数据模型与配置

- [x] 1.1 RED: 在 `backend/tests/unit/test_models.py` 增加 Pool model、`Policy.underwriter_pool_id`、active-per-user partial unique index 的断言；验证命令：`pytest backend/tests/unit/test_models.py -q`
- [x] 1.2 GREEN: 修改 `backend/models.py`，新增 `PoolStatus`、`PresetStyle`、`Pool` 和 `Policy.underwriter_pool_id`，用 SQLite partial unique index 保证单用户单 active pool；验证命令：`pytest backend/tests/unit/test_models.py -q`
- [x] 1.3 RED: 在 `backend/tests/unit/test_config.py` 覆盖 `POOL_SIMULATOR_ENABLED`、interval min/max、max policies 配置默认值；验证命令：`pytest backend/tests/unit/test_config.py -q`
- [x] 1.4 GREEN: 修改 `backend/config.py` 加入 pool simulator 配置，默认开启且 interval 为 8..15 秒；验证命令：`pytest backend/tests/unit/test_config.py -q`
- [x] 1.5 RED: 在 `backend/tests/unit/test_user_service.py` 或新增 `backend/tests/unit/test_system_sim_user.py` 覆盖 SYSTEM_SIM_USER seed 幂等、不可登录标记字段/约束；验证命令：`pytest backend/tests/unit/test_system_sim_user.py -q`
- [x] 1.6 GREEN: 在 `backend/pools/service.py` 或专用 seed helper 实现 SYSTEM_SIM_USER 幂等创建，并确保登录/leaderboard 路径不会暴露；验证命令：`pytest backend/tests/unit/test_system_sim_user.py -q`

## 2. Matcher 纯函数

- [x] 2.1 RED: 新增 `backend/tests/unit/test_pool_matcher.py`，覆盖 Steady/Storm/Hub preset、hub 白名单、thunderstorm 排除、red-eye、delay threshold 边界；验证命令：`pytest backend/tests/unit/test_pool_matcher.py -q`
- [x] 2.2 GREEN: 新增 `backend/pools/matcher.py`，实现 `match(pool, flight, tier)` 与 `first_match(policy, active_pools, flight_context)` 纯函数；验证命令：`pytest backend/tests/unit/test_pool_matcher.py -q`
- [x] 2.3 REFACTOR: 补齐 matcher 类型与常量命名，保持无数据库依赖；验证命令：`pytest backend/tests/unit/test_pool_matcher.py -q`

## 3. Pool Service

- [x] 3.1 RED: 新增 `backend/tests/unit/test_pool_service.py` 覆盖 open pool 扣 stake、409/IntegrityError 单池约束、初始 balance、timeline opened 事件；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.2 GREEN: 新增 `backend/pools/schemas.py` 与 `backend/pools/service.py`，实现 open/get active/list timeline 与 `pool.opened` 事件落库；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.3 RED: 扩展 `backend/tests/unit/test_pool_service.py` 覆盖 PATCH 只能改规则不能改 stake，且不追溯已绑定 active policy；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.4 GREEN: 实现 `patch_pool_rule`、`pool.rule_updated` timeline/WS payload 构造，确保只影响未来匹配；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.5 RED: 扩展 `backend/tests/unit/test_pool_service.py` 覆盖 user close：解绑未命中 active policy、返还 balance、写 `pool.closed(reason=user)`；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.6 GREEN: 实现 `close_pool(reason="user")` 与 `close_pool(reason="bankrupt")`，破产允许 balance 为负且保留已绑 active policy 跑完；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.7 RED: 增加 `bind_policy_to_pool`/premium 入池/`pool.policy_bound` 事件测试；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`
- [x] 3.8 GREEN: 实现 policy bind、premium 入池、exposure/P&L 计算和 timeline 事件写入；验证命令：`pytest backend/tests/unit/test_pool_service.py -q`

## 4. REST Routes

- [x] 4.1 RED: 新增 `backend/tests/integration/test_pools_routes.py` 覆盖 `POST /pools` 成功、已有 active 返回 409、未登录拒绝；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`
- [x] 4.2 GREEN: 新增 `backend/pools/routes.py` 并在 `backend/app.py` 注册，返回 `Pool` schema；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`
- [x] 4.3 RED: 扩展 routes 测试覆盖 `GET /pools/me`、`PATCH /pools/{id}`、跨用户 404/403、stake 不可改；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`
- [x] 4.4 GREEN: 实现 `GET /pools/me` 与 `PATCH /pools/{id}` 权限过滤和 WS 广播；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`
- [x] 4.5 RED: 扩展 routes 测试覆盖 `DELETE /pools/{id}` 与 `GET /pools/{id}/timeline?limit=50`；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`
- [x] 4.6 GREEN: 实现 close 与 timeline API，timeline 只返回当前用户 pool 事件；验证命令：`pytest backend/tests/integration/test_pools_routes.py -q`

## 5. Passenger Simulator

- [x] 5.1 RED: 新增 `backend/tests/unit/test_pool_simulator.py` 覆盖 interval 随机范围 8..15、`POOL_SIMULATOR_ENABLED=false` 不启动；验证命令：`pytest backend/tests/unit/test_pool_simulator.py -q`
- [x] 5.2 GREEN: 新增 `backend/pools/simulator.py`，实现可注入 sleep/random/session 的 async loop；验证命令：`pytest backend/tests/unit/test_pool_simulator.py -q`
- [x] 5.3 RED: 扩展 simulator 测试覆盖从 active flights 选取高延误权重、premium 5/10/20、owner 为 SYSTEM_SIM_USER；验证命令：`pytest backend/tests/unit/test_pool_simulator.py -q`
- [x] 5.4 GREEN: Simulator 复用 `PolicyService.create_policy` 路径创建保单，并用 matcher 绑定首个符合 active pool；验证命令：`pytest backend/tests/unit/test_pool_simulator.py -q`
- [x] 5.5 RED: 在 `backend/tests/integration/test_app_lifespan.py` 覆盖 app lifespan 启停 simulator task；验证命令：`pytest backend/tests/integration/test_app_lifespan.py -q`
- [x] 5.6 GREEN: 修改 `backend/app.py` 注入 `PassengerSimulator`，随 lifespan 启停并在 shutdown cancel；验证命令：`pytest backend/tests/integration/test_app_lifespan.py -q`

## 6. Policy Service 集成

- [x] 6.1 RED: 扩展 `backend/tests/unit/test_policy_service.py` 覆盖创建 simulator policy 不扣真实用户余额或按 SYSTEM_SIM_USER 语义处理；验证命令：`pytest backend/tests/unit/test_policy_service.py -q`
- [x] 6.2 GREEN: 调整 `backend/policies/service.py` 支持 simulator/system owner 创建路径，同时不破坏普通用户 `POST /policies` 扣 premium；验证命令：`pytest backend/tests/unit/test_policy_service.py -q`
- [x] 6.3 RED: 扩展 `backend/tests/integration/test_policies_routes.py` 覆盖普通用户手动投保仍无 `underwriter_pool_id` 且现有 API 兼容；验证命令：`pytest backend/tests/integration/test_policies_routes.py -q`
- [x] 6.4 GREEN: 保持 `backend/policies/routes.py` 现有手动投保行为兼容，并在公开 schema 中安全处理 pool 字段；验证命令：`pytest backend/tests/integration/test_policies_routes.py -q`

## 7. Claim Engine 集成

- [x] 7.1 RED: 新增 `backend/tests/unit/test_claim_engine_pool_payout.py` 覆盖 bound policy 延误触发后从 pool balance 扣 payout、不加到 SYSTEM_SIM_USER 余额；验证命令：`pytest backend/tests/unit/test_claim_engine_pool_payout.py -q`
- [x] 7.2 GREEN: 修改 `backend/claims/engine.py`，当 `policy.underwriter_pool_id` 存在时调用 pool payout service 扣款；验证命令：`pytest backend/tests/unit/test_claim_engine_pool_payout.py -q`
- [x] 7.3 RED: 扩展 pool payout 测试覆盖同 tick 多单结算后 balance 可为负，tick 完成后 `close_pool(bankrupt)`；验证命令：`pytest backend/tests/unit/test_claim_engine_pool_payout.py -q`
- [x] 7.4 GREEN: 实现 bankrupt close 调用、`pool.claim_paid` payload、`claim.settled.pool_id` 字段，保留无池路径回归；验证命令：`pytest backend/tests/unit/test_claim_engine_pool_payout.py backend/tests/unit/test_claim_engine.py -q`

## 8. WebSocket 与 Flight Payload

- [x] 8.1 RED: 扩展 `backend/tests/unit/test_broadcaster.py` 覆盖 pool event type 枚举；验证命令：`pytest backend/tests/unit/test_broadcaster.py -q`
- [x] 8.2 GREEN: 修改 `backend/ws/broadcaster.py` 增加 pool event type，保持现有 event type 值不变；验证命令：`pytest backend/tests/unit/test_broadcaster.py -q`
- [x] 8.3 RED: 扩展 `backend/tests/integration/test_flights_routes.py` 覆盖 `/flights/live` 返回当前用户上下文下的 `underwritten_by_pool_id`；验证命令：`pytest backend/tests/integration/test_flights_routes.py -q`
- [x] 8.4 GREEN: 修改 `backend/flights/routes.py` 与前端 `FlightPublic` 类型，为 Tower 提供可空 `underwritten_by_pool_id`；验证命令：`pytest backend/tests/integration/test_flights_routes.py -q && cd frontend && pnpm test -- --run src/tests/useFlights.test.tsx`

## 9. 前端 API 与 Store

- [x] 9.1 RED: 新增 `frontend/src/tests/pool-api.test.ts` 覆盖 `openPool/getMyPool/patchPool/closePool/getTimeline` 请求路径与错误；验证命令：`cd frontend && pnpm test -- --run src/tests/pool-api.test.ts`
- [x] 9.2 GREEN: 新增 `frontend/src/api/pool.ts` 实现 pool REST client 类型与函数；验证命令：`cd frontend && pnpm test -- --run src/tests/pool-api.test.ts`
- [x] 9.3 RED: 新增 `frontend/src/tests/pool-store.test.ts` 覆盖 pool.* WS 事件更新 active pool、underwritten flight id set、P/L、event ticker；验证命令：`cd frontend && pnpm test -- --run src/tests/pool-store.test.ts`
- [x] 9.4 GREEN: 新增 `frontend/src/store/pool.ts` 并修改 `frontend/src/hooks/useWebSocket.ts` 路由 pool.* 事件到 pool store；验证命令：`cd frontend && pnpm test -- --run src/tests/pool-store.test.ts src/tests/useWebSocket.test.ts`

## 10. 前端 Studio 组件

- [x] 10.1 RED: 新增 `frontend/src/tests/studio-preset-cards.test.tsx` 覆盖三张 preset 卡与规则初值；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-preset-cards.test.tsx`
- [x] 10.2 GREEN: 新增 `frontend/src/components/studio/PresetCards.tsx`，仅使用 `tokens.css` 变量和英文文案；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-preset-cards.test.tsx`
- [x] 10.3 RED: 新增 `frontend/src/tests/studio-rule-line.test.tsx` 覆盖 RuleLine、RuleChipEditor、popover、chip 回写；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-rule-line.test.tsx`
- [x] 10.4 GREEN: 新增 `RuleLine.tsx` 与 `RuleChipEditor.tsx`，英文文案、无新 hex/字体；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-rule-line.test.tsx`
- [x] 10.5 RED: 新增 `frontend/src/tests/studio-stake-slider.test.tsx` 覆盖 stake slider、Expected 7d hit/PL 展示、CTA disabled；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-stake-slider.test.tsx`
- [x] 10.6 GREEN: 新增 `StakeSlider.tsx` 与 expected 指标计算 helper；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-stake-slider.test.tsx`
- [x] 10.7 RED: 新增 `frontend/src/tests/studio-pool-dashboard.test.tsx` 覆盖 KPI band、event ticker、PAID OUT/P&L；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-pool-dashboard.test.tsx`
- [x] 10.8 GREEN: 新增 `PoolDashboard.tsx`，渲染 active pool KPI 与 ticker；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-pool-dashboard.test.tsx`

## 11. Studio 页面与路由

- [x] 11.1 RED: 新增 `frontend/src/tests/studio-shell.test.tsx` 覆盖 empty 状态、Open Pool 成功进入 active 状态；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-shell.test.tsx`
- [x] 11.2 GREEN: 新增 `frontend/src/routes/StudioShell.tsx`，接入 pool API/store 与 empty/active 两态；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-shell.test.tsx`
- [x] 11.3 RED: 扩展 `frontend/src/tests/App.test.tsx` 覆盖 `/studio` protected route；验证命令：`cd frontend && pnpm test -- --run src/tests/App.test.tsx`
- [x] 11.4 GREEN: 修改 `frontend/src/App.tsx` 注册 `/studio` 路由；验证命令：`cd frontend && pnpm test -- --run src/tests/App.test.tsx`

## 12. Nav 集成

- [x] 12.1 RED: 扩展 `frontend/src/tests/top-nav.test.tsx` 覆盖 `STUDIO` tab、active route、P/L 正绿负琥珀、closed 1s badge；验证命令：`cd frontend && pnpm test -- --run src/tests/top-nav.test.tsx`
- [x] 12.2 GREEN: 修改 `frontend/src/components/shell/TopNav.tsx` 添加 STUDIO tab 与 badge，使用 `--accent-radar`/`--warn-amber`；验证命令：`cd frontend && pnpm test -- --run src/tests/top-nav.test.tsx`

## 13. Tower 联动

- [x] 13.1 RED: 扩展 `frontend/src/tests/globe-map-camera.test.tsx` 或新增 `frontend/src/tests/globe-map-underwriter.test.tsx` 覆盖 `.flight-dot--mine` 与 protagonist ring 可共存；验证命令：`cd frontend && pnpm test -- --run src/tests/globe-map-underwriter.test.tsx`
- [x] 13.2 GREEN: 修改 `frontend/src/components/tower/GlobeMap.tsx`，根据 `underwritten_by_pool_id` 与 pool store 添加 `.flight-dot--mine`，不改 protagonist ring；验证命令：`cd frontend && pnpm test -- --run src/tests/globe-map-underwriter.test.tsx`
- [x] 13.3 RED: 扩展 GlobeMap 测试覆盖 `pool.claim_paid` 后 1.4s 绿色 FLARE 元素出现并消失；验证命令：`cd frontend && pnpm test -- --run src/tests/globe-map-underwriter.test.tsx`
- [x] 13.4 GREEN: 修改 `frontend/src/components/tower/GlobeMap.tsx` 与 `GlobeMap.css`，新增 `.flight-dot--mine` 与绿色 flare 层，复用现有动画节奏；验证命令：`cd frontend && pnpm test -- --run src/tests/globe-map-underwriter.test.tsx`

## 14. Copilot 集成

- [x] 14.1 RED: 扩展 `backend/tests/unit/test_copilot_service.py` 覆盖 `subject_type=pool` 或 Studio 上下文注入当前 active pool、bound policies、claims、P/L；验证命令：`pytest backend/tests/unit/test_copilot_service.py -q`
- [x] 14.2 GREEN: 修改 `backend/copilot/schemas.py`、`backend/copilot/context.py`、`backend/copilot/service.py`，复用 `/copilot/ask/stream` 注入 pool 上下文，不新建 endpoint；验证命令：`pytest backend/tests/unit/test_copilot_service.py -q`
- [x] 14.3 RED: 新增 `frontend/src/tests/studio-copilot-panel.test.tsx` 覆盖页面初载、open 后 3s、首 bind、每 5 bind/payout、bankrupt briefing 触发；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-copilot-panel.test.tsx`
- [x] 14.4 GREEN: 新增 `frontend/src/components/studio/PoolCopilotPanel.tsx`，调用现有 Copilot provider/stream 并保持英文可见文案；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-copilot-panel.test.tsx`

## 15. Dev Inject

- [x] 15.1 RED: 新增 `frontend/src/tests/studio-dev-inject.test.tsx` 覆盖 `DEV_LOGIN_ENABLED=true` 显示按钮、false 隐藏、点击调用现有 inject-delay；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-dev-inject.test.tsx`
- [x] 15.2 GREEN: 新增 `frontend/src/components/studio/DevInjectDelayButton.tsx`，仅开发登录开启时可见，英文文案 `Inject demo delay`；验证命令：`cd frontend && pnpm test -- --run src/tests/studio-dev-inject.test.tsx`
- [x] 15.3 RED: 扩展 `backend/tests/integration/test_admin_routes.py` 或 pools route 测试，确认 `/auth/dev-login` 与现有 inject-delay API 不被弱化；验证命令：`pytest backend/tests/integration/test_dev_login.py backend/tests/integration/test_admin_routes.py -q`
- [x] 15.4 GREEN: 如需调整配置读取，只修改前端 dev 可见性，不关闭 dev login；验证命令：`pytest backend/tests/integration/test_dev_login.py backend/tests/integration/test_admin_routes.py -q`

## 16. E2E 与全量验证

- [x] 16.1 RED: 新增 `frontend/e2e/studio-open-to-first-bind.spec.ts`，登录、进入 `/studio`、Open Steady、等待 20s 内 bound KPI 为 1；验证命令：`cd frontend && PLAYWRIGHT_USE_LOCAL_SERVER=1 pnpm exec playwright test e2e/studio-open-to-first-bind.spec.ts`
- [ ] 16.2 GREEN: 修复前后端联动直到 `studio-open-to-first-bind` 通过；验证命令：`cd frontend && PLAYWRIGHT_USE_LOCAL_SERVER=1 pnpm exec playwright test e2e/studio-open-to-first-bind.spec.ts`
- [x] 16.3 RED: 新增 `frontend/e2e/studio-inject-payout.spec.ts`，开池、点击 dev inject-delay、断言 Tower FLARE 与 PAID OUT 更新；验证命令：`cd frontend && PLAYWRIGHT_USE_LOCAL_SERVER=1 pnpm exec playwright test e2e/studio-inject-payout.spec.ts`
- [ ] 16.4 GREEN: 修复 dev inject 和 payout 展示直到 e2e 通过；验证命令：`cd frontend && PLAYWRIGHT_USE_LOCAL_SERVER=1 pnpm exec playwright test e2e/studio-inject-payout.spec.ts`
- [x] 16.5 VERIFY: 运行后端全量测试；验证命令：`pytest backend/tests -v`
- [x] 16.6 VERIFY: 运行前端全量 Vitest；验证命令：`cd frontend && pnpm test`
- [ ] 16.7 VERIFY: 运行新增 Playwright 用例；验证命令：`cd frontend && pnpm exec playwright test e2e/studio-open-to-first-bind.spec.ts e2e/studio-inject-payout.spec.ts`
- [ ] 16.8 VERIFY: 手动执行 `./scripts/dev.sh`，dev login，进入 `/studio`，开 Steady 池，15s 内 Tower 绿点，点击 `Inject demo delay`，确认绿色 FLARE、PAID OUT、pool.claim_paid 和 Copilot briefing；验证命令：人工记录步骤与观察结果
- [x] 16.9 VERIFY: 运行 OpenSpec 校验并更新任务状态；验证命令：`openspec validate add-underwriter-studio --strict --no-interactive`
- [x] 16.10 VERIFY: 修改代码后重建 graphify；验证命令：`python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
