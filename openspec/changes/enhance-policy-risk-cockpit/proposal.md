## Why

Rialo-Captain 的投保、自动赔付和证据链已经成型，但用户在 My Hangar 里还难以快速判断自己当前承保敞口、哪些保单正在接近赔付条件，以及 Flight Detail 上的报价为什么成立。下一步应把这些产品判断前置，让用户自然理解风险、报价和持仓状态，而不是只在赔付后看结果。

## What Changes

- 将 My Hangar 从三列记录列表增强为风险驾驶舱，展示 active exposure、最大潜在赔付、已结算赔付、当前 at-risk 保单数等摘要。
- 为保单卡片增加风险语义：live delay、距离 30 分钟阈值的状态、潜在赔付、创建时间和证据入口，并按风险优先排序 active 保单。
- 在 Flight Detail 的购买区域增加报价解释，说明保费档位、历史延误率、倍率、赔付条件和自动结算来源。
- 当用户已持有当前航班 active policy 时，在购买区域展示持仓摘要、潜在赔付和 Evidence 入口，而不是只给一个跳转链接。
- 为前端提供非破坏性的 policy risk projection 数据契约；实现可以扩展 `GET /policies` 响应字段，或提供等价的受保护聚合数据，但不得改变现有字段语义。
- 保持 Cinema 自动化、大屏事件链、Evidence Drawer、Copilot 只读边界和现有投保/赔付语义不变。

## Capabilities

### New Capabilities
- 无。本变更增强现有产品页面和数据契约，不新增独立能力域。

### Modified Capabilities
- `live-dashboard`: 增强 My Hangar 风险驾驶舱、Flight Detail 报价解释和 active policy 持仓摘要的用户可见行为。
- `reactive-insurance-core`: 扩展保单列表的只读风险投影数据要求，确保 UI 可以解释当前承保敞口而不改变投保或赔付规则。

## Impact

- Affected specs: `live-dashboard`, `reactive-insurance-core`
- Affected backend: `backend/policies/schemas.py`, `backend/policies/routes.py`, `backend/policies/service.py`, `backend/flights/service.py` 或等价风险投影 helper
- Affected frontend: `frontend/src/routes/MyHangar.tsx`, `frontend/src/routes/FlightDetail.tsx`, `frontend/src/components/hangar/*`, `frontend/src/components/flight/InsureBlock.tsx`, `frontend/src/hooks/usePolicies.ts`, shared policy/risk types
- Affected tests: backend policy route/service tests, frontend MyHangar/FlightDetail/HangarSlot/InsureBlock Vitest coverage, optional Playwright smoke for `/policies` and `/flight/:id`
- Dependencies: no new runtime dependency expected
