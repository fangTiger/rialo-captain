## Context

当前系统已经具备投保、合约 adapter watch、后台 ClaimEngine、WebSocket 事件、大屏 Cinema 动效和 Claims Feed 展示。问题是这些事件大多只以运行时动作或前端内存事件存在：`Claim` 表保存了最终赔付结果，`Policy` 表保存了保单状态，但缺少一条可查询、可排序、可解释的过程记录。

本变更跨后端数据模型、赔付流程、REST API 和前端展示。它不改变现有投保与赔付语义，而是在关键业务节点旁路记录证据事件，并让用户可以从 claim、policy 或 flight 上查看完整 timeline。

## Goals / Non-Goals

**Goals:**
- 为每张保单建立持久化 timeline，覆盖创建、监听、观测、条件命中、赔付触发、结算、余额到账和落地确认。
- 提供按 `policy_id` 与 `claim_id` 查询的证据链 API，并保证普通用户只能查看自己的保单证据。
- 在 Claims Feed、My Hangar、Flight Detail 的相关条目上提供 Evidence Drawer 入口。
- 保持 `GET /claims/recent`、`POST /policies` 和现有 WebSocket payload 兼容。
- 用 TDD 覆盖后端写入顺序、权限、API 过滤和前端基本交互。

**Non-Goals:**
- 不实现真实链上浏览器或真实 Rialo SDK 集成。
- 不改变赔付倍率、保费档位、ClaimEngine 触发条件或 Cinema 时间线。
- 不做长期审计归档、导出 CSV/PDF 或管理员全局审计后台。
- 不引入迁移框架；沿用当前 `init_db()`/SQLAlchemy metadata 建表方式。

## Decisions

### 1. 新增 `PolicyEvent` 持久化模型

新增表 `policy_events`，字段建议为：

- `id`: 16 位短 uuid，主键
- `policy_id`: 外键到 `policies.id`
- `flight_id`: 冗余字段，便于按航班过滤和前端空态
- `claim_id`: nullable，claim 创建后关联
- `event_type`: 字符串，例如 `policy.created`
- `title`: 简短中文标题，前端可直接显示
- `payload_json`: JSON 文本，保存结构化细节
- `source`: `user` / `contract` / `engine` / `mock-chain` / `system`
- `created_at`: 秒级时间戳
- `event_sequence`: 单调递增或纳秒级整数，用于同秒事件的流程顺序

选择独立事件表，而不是把数组 JSON 塞进 `Policy` 或 `Claim`，是因为事件会在不同流程阶段逐步追加，独立表更容易查询、排序和测试，也避免更新大 JSON 字段造成并发覆盖。

### 2. 用 `EvidenceService` 统一写入与查询

新增 `backend/evidence/service.py`。所有写事件的代码调用 service，而不是在路由和 engine 中散落 `PolicyEvent(...)` 构造。service 提供：

- `record_policy_created(policy, flight, premium, payout, delay_rate)`
- `record_contract_watched(policy, contract_ref)`
- `record_observation(policy, delay_minutes, source)`
- `record_condition_matched(policy, delay_minutes, threshold_min)`
- `record_claim_triggered(policy, delay_minutes)`
- `record_claim_settled(policy, claim, tx_hash, signature, settle_duration_ms)`
- `record_balance_credited(policy, claim, balance_after)`
- `record_flight_landed(policy, claim)`
- `timeline_for_policy(user, policy_id)`
- `timeline_for_claim(user, claim_id)`

这样 worker 可以按 TDD 逐步落点：先 service 单元测试，再集成到 `policies/routes.py` 与 `claims/engine.py`。

`record_event` MUST 校验 `policy_id` 存在，且传入的 `flight_id` 与该 policy 的 `flight_id` 一致；若传入 `claim_id`，还 MUST 校验 claim 属于同一 policy。校验失败时抛出领域异常，避免跨对象证据事件落库。

### 3. 权限以保单归属为准

证据链里含余额、保单和 mock tx 信息，普通用户只能查询自己的 policy/claim。API 查询时通过 `Policy.user_id == current_user.id` 判断归属；不存在或不归属统一返回 404，避免泄露资源存在性。admin 暂不加全局查询能力，保持范围小。

### 4. REST API 独立于现有 claims 列表

新增：

- `GET /policies/{policy_id}/timeline`
- `GET /claims/{claim_id}/timeline`

响应统一为：

```json
{
  "subject": { "policy_id": "...", "claim_id": "...", "flight_id": "..." },
  "events": [
    {
      "id": "...",
      "type": "claim.settled",
      "title": "赔付已结算",
      "source": "mock-chain",
      "created_at": 1760000000,
      "payload": { "payout": 80, "tx_hash": "0x..." }
    }
  ]
}
```

不把 timeline 嵌入 `GET /claims/recent`，因为列表页应保持轻量，详情按需请求。

### 5. 前端用一个复用 Evidence Drawer

新增 `frontend/src/components/evidence/EvidenceDrawer.tsx` 与 `frontend/src/hooks/useEvidenceTimeline.ts`。入口：

- Claims Feed：`ClaimRow` 保持整行点击跳转航班，同时新增一个小型 `Evidence` 操作按钮，点击打开 drawer 并 `stopPropagation`。
- Flight Detail：`RelatedClaims` 和 `RelatedPolicies` 条目提供同样入口。
- My Hangar：`HangarSlot` 提供 policy timeline 入口。

Drawer 使用现有暗色 token、font mono 和紧凑时间线，不做新的 landing/hero。事件 payload 默认摘要显示，支持展开查看结构化字段。

### 6. 前端不依赖 WebSocket 内存事件

Evidence Drawer 始终从 REST API 拉取持久化 timeline。WebSocket 仍服务 Cinema 和实时 toast；持久证据链是刷新后仍存在的真实来源。若 claim 刚从 optimistic flare 出现而 API 暂无 timeline，drawer 显示短暂空态并允许重新请求。

## Risks / Trade-offs

- 事件写入增加流程耦合 → 通过 `EvidenceService` 集中处理，调用点只传领域对象和少量上下文。
- ClaimEngine 事件和 DB commit 顺序复杂 → claim 创建后、结算事务提交前尝试写 settled/balance/landed 证据事件；证据写入使用 savepoint 或等价隔离，失败时回滚证据 savepoint 但保留 claim、余额和 policy 状态更新。
- 保单创建证据失败导致 opening timeline 缺失 → policy.created 与 contract.watched 作为创建事务的一部分写入，失败则不返回“创建成功”，避免静默缺失起点事件。
- SQLite 旧库没有新表 → 当前项目用 metadata 建表，启动后创建新表；若用户保留旧 claims，历史 claim 不自动补 timeline，前端显示“暂无证据事件”。
- ClaimRow 新增按钮可能影响整行点击 → 用按钮自身 `stopPropagation` 并补键盘测试，保留原跳转行为。
- 事件 payload 过多导致 UI 噪音 → Drawer 首屏展示标题、时间、source 和摘要，payload 以可展开详情承载。

## Migration Plan

1. 新增 `PolicyEvent` 模型和 `EvidenceService`，启动时由 `init_db()` 创建新表。
2. 先接入 `POST /policies`，新建保单成功后写 `policy.created` 与 `contract.watched`。
3. 再接入 `ClaimEngine`，在观测、命中、触发、结算和落地阶段写事件。
4. 新增 timeline API 和权限测试。
5. 新增前端 hook、drawer 和页面入口。
6. 验证后端、前端单测和 OpenSpec。

Rollback：删除前端入口即可隐藏功能；后端事件写入是旁路记录，不影响原投保/赔付流程。若需要完全回滚，可移除 service 调用和新 router，保留未使用的表不影响运行。

## Open Questions

- 历史 claim 是否需要补 timeline？本设计不补，后续可单独做 backfill。
- Evidence Drawer 是否需要从 URL deep-link 打开？本设计只做页面内 drawer，避免新增路由复杂度。
