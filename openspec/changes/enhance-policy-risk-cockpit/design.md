## Context

当前 My Hangar 已按 `active`、`paid`、`expired` 三列展示用户保单，并且保单卡片已经支持跳转 Flight Detail、打开 Evidence Drawer 和启动只读 Copilot。Flight Detail 已包含 Hero、KPI、DelayHistogram、InsureBlock、Related Policies 和 Related Claims，但购买区域只展示估算赔付，用户需要自己拼接 delay rate、multiplier、live delay 与持仓状态。

本变更继续推进产品能力，不增加演讲控制台或手动导播。目标是让用户进入 `/policies` 时立刻知道“我现在承保了多少、最多可能赔多少、哪些保单接近触发”，进入 `/flight/:id` 时立刻理解“这个报价为什么是这样、我是否已经持仓、持仓当前风险如何”。

## Goals / Non-Goals

**Goals:**
- 为 `GET /policies` 增加非破坏性的只读风险投影字段，避免前端为每张保单单独拉航班详情。
- 在 My Hangar 顶部展示 active exposure、maximum potential payout、settled payout、at-risk policy count。
- 让 active 保单按风险优先排序，并在卡片中展示 live delay、阈值距离、潜在赔付和 Evidence/Copilot 操作。
- 在 Flight Detail 的 Insure 区域展示报价解释，包括保费、倍率、历史延误率、30 分钟阈值和自动结算说明。
- 当用户已持有当前航班 active policy 时，展示持仓摘要与 Evidence 入口，而不是只给一个 Hangar 跳转。
- 用 TDD 覆盖后端 risk projection、前端摘要计算、排序、报价解释和 active 持仓展示。

**Non-Goals:**
- 不改变保费档位、赔付倍率算法、ClaimEngine 触发条件或 settlement evidence 写入语义。
- 不新增手动 demo director、演讲脚本、可暂停导播或后台运营控制台。
- 不新增数据库表或迁移框架；风险投影从现有 Policy、Flight、delay override/cache 数据派生。
- 不实现真实 Rialo SDK、真实链上浏览器或新的通知中心。
- 不让 Copilot 直接购买、取消或修改保单。

## Decisions

### 1. 扩展 `GET /policies` 的只读投影字段

在 `PolicyPublic` 上增加可选/nullable 字段，而不是新增必需写模型：

- `delay_threshold_minutes`: 当前固定为 `30`
- `live_delay_minutes`: 从现有 flight detail 延误计算路径复用，无法计算时为 `null`
- `minutes_until_trigger`: active policy 距离阈值的分钟数；已达到阈值时为 `0`；无法计算或非 active 时为 `null`
- `risk_level`: `triggered` / `watch` / `normal` / `unknown` / `settled` / `inactive`
- `risk_reason`: 英文短句，用于卡片解释和测试稳定断言

选择扩展现有 `/policies`，而不是新增 `/policies/risk-summary`，是因为 My Hangar 已经以 `usePolicies()` 为单一数据入口，扩展字段是向后兼容的 JSON 增量。若实现时发现计算成本需要拆分，也可以在 service 内部保留同一 hook 返回形态，但外部行为仍以“保单列表携带风险投影”为准。

风险投影只能用于展示和排序，MUST NOT 被 ClaimEngine 用作结算输入。ClaimEngine 仍读取自己的观测源和条件解析逻辑。

### 2. 后端集中计算 risk projection

新增或扩展 `PolicyService` helper，按用户 policy 批量加载关联 flights，并复用 `FlightService` 中已有的 `live_delay_minutes` 解析逻辑或抽取一个纯函数。这样避免前端 N+1 请求，也让风险等级规则可由后端单测固定。

建议规则：

- `status == "paid"` -> `risk_level = "settled"`
- `status == "expired"` -> `risk_level = "inactive"`
- active 且 `live_delay_minutes is null` -> `unknown`
- active 且 `live_delay_minutes >= 30` -> `triggered`
- active 且 `20 <= live_delay_minutes < 30` -> `watch`
- active 且 `< 20` -> `normal`

`minutes_until_trigger` 对 active 且有 live delay 的保单使用 `max(0, 30 - live_delay_minutes)`。

### 3. My Hangar 前端仍保持密集产品界面

`MyHangar` 顶部新增紧凑 summary band，不做 marketing hero：

- Active exposure: active policies 的 `premium` 合计
- Max potential payout: active policies 的 `payout` 合计
- At risk: active 且 `risk_level in ("triggered", "watch")` 的数量
- Settled payout: paid policies 的 `payout` 合计

列表仍按状态分组，但 active lane 按 `triggered > watch > unknown > normal`，再按 `payout DESC` 和 `created_at DESC` 排序。卡片追加一行 risk strip，展示 live delay、threshold、minutes until trigger 和 risk reason。Evidence 与 Copilot 入口保持当前 `stopPropagation` 行为。

### 4. Flight Detail 报价解释内聚在 InsureBlock

`InsureBlock` 继续负责购买操作，但新增 quote explanation 子区：

- premium tier 当前选择值
- multiplier 与 delay rate 的对应关系
- estimated payout
- coverage condition: delayed `>= 30 min`
- settlement path: reactive contract watches flight data and settles automatically

当用户已有 active policy 时，`InsureBlock` 改渲染 active holding summary：active policy count、total premium、total potential payout、最高风险等级、Evidence 入口，以及保留 `View in Hangar` 链接。这样用户不用离开航班详情也能理解自己的持仓。

### 5. 类型和兼容性

前端 `Policy` 类型增加可选字段，旧响应在测试或本地缓存中缺失这些字段时，UI 使用 `unknown` 和占位文案降级。后端响应必须保留现有字段：`id`、`flight_id`、`premium`、`payout`、`status`、`contract_ref`、`created_at`。

## Risks / Trade-offs

- 风险投影被误认为赔付判定来源 -> UI 文案明确使用 “current signal” 和 “projection”，spec 要求 ClaimEngine 不依赖该字段。
- `/policies` 计算变重 -> 批量加载 flights，并复用纯函数计算；保单数量在当前产品阶段较小，先不引入缓存。
- active policy 已达阈值但 ClaimEngine 尚未完成赔付 -> 展示 `triggered`/`At threshold`，并保留 Evidence 入口；最终状态仍以 claim/policy 更新为准。
- live delay 缺失导致摘要不完整 -> `unknown` risk level 不计入 at-risk，但卡片显示数据不可用，不阻塞其他保单。
- Flight Detail 和 My Hangar 重复展示持仓信息 -> Flight Detail 只展示当前航班 active 摘要，完整历史仍在 My Hangar。

## Migration Plan

1. 后端先增加 risk projection 字段和单测，确保旧字段不变。
2. 前端更新 `Policy` 类型和 fallback，旧测试 fixture 缺字段时仍通过。
3. 增加 My Hangar summary band、active 排序和 card risk strip。
4. 增强 Flight Detail `InsureBlock` 的 quote explanation 与 active holding summary。
5. 跑 focused backend/frontend tests，再跑相关全量套件；最后 `openspec validate enhance-policy-risk-cockpit --strict --no-interactive`。

Rollback：前端可以忽略新增字段回到旧列表；后端新增 JSON 字段向后兼容，不需要数据库回滚。

## Open Questions

- `watch` 阈值先定为距离触发 10 分钟内，即 live delay >= 20；后续可根据产品数据调整。
- 是否把 failed policy 单独纳入 Hangar 分组？当前后端公开状态只有 active/paid/expired，本变更先不引入新状态。
