## Why

Rialo-Captain 已经能完成实时航班投保、延误触发、自动赔付和 Cinema 大屏动效，但用户目前只能看到结果，缺少一条可持久查询的“为什么赔、何时赔、依据是什么”的证据链。把结算过程沉淀为可回放 timeline，可以让 demo 从视觉闭环升级为可解释、可审计、可复盘的产品体验。

## What Changes

- 新增持久化结算证据链，记录保单创建、合约监听、观测、条件命中、赔付触发、链上结算、余额到账和航班落地等关键事件。
- 新增证据链查询 API，支持按 `policy_id` 或 `claim_id` 获取有序 timeline。
- 在 Claims Feed、Flight Detail 和 Hangar 相关入口中提供 Evidence Drawer，用于查看每笔保单/赔付的回放详情。
- 保持现有 `POST /policies`、`GET /claims/recent`、WebSocket 事件语义兼容，不改变现有 Cinema 事件链。
- 不引入新的外部依赖；沿用 SQLite、SQLAlchemy、FastAPI、React、SWR 和现有设计 token。

## Capabilities

### New Capabilities
- `settlement-evidence`: 定义保单与赔付的持久化证据链、查询 API、前端回放抽屉、权限与降级行为。

### Modified Capabilities
- `reactive-insurance-core`: 在现有自动赔付流程中增加可持久审计的事件记录要求。
- `live-dashboard`: 在现有 Claims Feed、Flight Detail、My Hangar 等页面中增加证据链入口与展示要求。

## Impact

- Affected specs: `settlement-evidence`, `reactive-insurance-core`, `live-dashboard`
- Affected backend: `backend/models.py`, `backend/db.py`, `backend/policies/routes.py`, `backend/claims/engine.py`, `backend/claims/routes.py`, 新增证据链 service/schema/tests
- Affected frontend: `frontend/src/hooks`, `frontend/src/components`, `frontend/src/routes/ClaimsFeed.tsx`, `frontend/src/routes/FlightDetail.tsx`, `frontend/src/components/claims/ClaimRow.tsx`, `frontend/src/components/hangar/*`
- Affected tests: backend unit/integration tests, frontend Vitest component/hook tests, optional Playwright smoke
