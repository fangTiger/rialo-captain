# Settlement Evidence Replay Implementation Plan

> **For worker:** REQUIRED SUB-SKILL: Use `test-driven-development` for every implementation task. Work in `/private/tmp/rialo-captain-settlement-evidence`. Use model `gpt-5.4` with reasoning `xhigh` as configured by the controller.
> **For reviewer:** Review with model `gpt-5.4` and reasoning `xhigh`. First check spec compliance, then code quality.

**Goal:** Add persistent settlement evidence timelines and an Evidence Drawer so users can explain and replay why a policy paid out.

**Architecture:** Backend adds a `PolicyEvent` table and `EvidenceService` that records timeline events from policy creation and ClaimEngine settlement. REST endpoints expose policy/claim timelines with owner-only access. Frontend adds a SWR hook and reusable drawer, then wires Evidence actions into claim and policy rows without breaking existing navigation.

**Tech Stack:** FastAPI, SQLAlchemy async, SQLite, pytest, React 18, TypeScript, SWR, Vitest, Testing Library.

---

## Coordination Rules

- Do not edit `frontend/src/routes/Login.css`, `frontend/src/routes/Login.tsx`, or `frontend/src/tests/login.test.tsx`; those are user changes in the main workspace.
- Keep worker edits scoped to `/private/tmp/rialo-captain-settlement-evidence`.
- Do not revert unrelated files or generated state.
- Follow RED-GREEN-REFACTOR: write focused failing tests, run them to see the expected failure, implement minimal code, rerun.
- After code changes, run graphify rebuild from the worktree if graphify is importable:
  `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`

## Task 1: Backend Evidence Foundation

**Files:**
- Modify: `backend/models.py`
- Create: `backend/evidence/__init__.py`
- Create: `backend/evidence/schemas.py`
- Create: `backend/evidence/service.py`
- Create: `backend/tests/unit/test_evidence_service.py`
- Modify: `backend/tests/factories.py`

**Step 1: RED - model and service tests**

Create `backend/tests/unit/test_evidence_service.py` with tests for:
- `EvidenceService.record_event()` persists `PolicyEvent` with `policy_id`, `flight_id`, `event_type`, `title`, `source`, JSON payload, `created_at`, and internal ordering metadata.
- `timeline_for_policy(user, policy_id)` returns events ordered by `created_at ASC, event_sequence ASC, id ASC` and preserves same-second write order.
- `timeline_for_policy` returns empty events for an owned policy with no events.
- other-user access raises a not-found style exception or returns `None` according to the service API.
- missing policy raises the same not-found style exception.
- `record_event()` rejects a `flight_id` that does not match the policy.
- `record_event()` rejects a `claim_id` that does not belong to the policy.

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/unit/test_evidence_service.py -q
```

Expected RED: fails because `backend.evidence` and `PolicyEvent` do not exist.

**Step 2: GREEN - model and service**

Add `PolicyEvent` to `backend/models.py`. Suggested fields:

```python
class PolicyEvent(Base):
    __tablename__ = "policy_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    policy_id: Mapped[str] = mapped_column(ForeignKey("policies.id"))
    flight_id: Mapped[str] = mapped_column(String(32))
    claim_id: Mapped[str | None] = mapped_column(ForeignKey("claims.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(32))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[int] = mapped_column(Integer, default=_now)
    event_sequence: Mapped[int] = mapped_column(Integer, default=_now_ns)
```

Also add an index for the timeline query path, such as `policy_id, created_at, event_sequence, id`.

Implement `EvidenceService` with a narrow `record_event(...)` primitive plus convenience wrappers only when needed by later tasks. `record_event()` MUST load the policy and validate that `flight_id` matches `policy.flight_id`; when `claim_id` is provided, it MUST validate that the claim belongs to the same policy. Return Pydantic schemas from `backend/evidence/schemas.py`:

```python
class EvidenceEventPublic(BaseModel):
    id: str
    type: str
    title: str
    source: str
    created_at: int
    payload: dict[str, Any]

class EvidenceSubjectPublic(BaseModel):
    policy_id: str
    flight_id: str
    claim_id: str | None = None

class EvidenceTimelinePublic(BaseModel):
    subject: EvidenceSubjectPublic
    events: list[EvidenceEventPublic]
```

**Step 3: GREEN verification**

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/unit/test_evidence_service.py -q
```

Expected: PASS.

**Review fix note:** If code review flags same-second ordering or cross-object data integrity, fix those in Task 1 before continuing. Add RED tests that force random ids to sort opposite insertion order, then prove `event_sequence` preserves write order.

## Task 2: Backend Flow Integration

**Files:**
- Modify: `backend/policies/routes.py`
- Modify: `backend/claims/engine.py`
- Modify: `backend/tests/integration/test_policies_routes.py`
- Modify: `backend/tests/unit/test_claim_engine.py`

**Step 1: RED - policy creation events**

Add an integration test proving successful `POST /policies` writes `policy.created` and `contract.watched`. Assert payload includes `premium`, `payout`, `flight_id`, `delay_rate`, and `contract_ref`.

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/integration/test_policies_routes.py -q -k evidence
```

Expected RED: events not present.

**Step 2: GREEN - policy creation events**

- In `create_policy`, after adapter watch/attach and before the `POST /policies` commit, use `EvidenceService(session)` to record:
- `policy.created`, source `user`, title `保单已创建`
- `contract.watched`, source `contract`, title `合约监听已建立`

Keep existing `PolicyPublic` response unchanged. Do not swallow evidence failures on this path; if opening evidence cannot be written, the route must not return a successful creation response.

**Step 3: RED - ClaimEngine settlement events**

Extend `backend/tests/unit/test_claim_engine.py` with tests for:
- triggered settlement writes `observation.received`, `condition.matched`, `claim.triggered`, `claim.settled`, `balance.credited`, `flight.landed`.
- below-threshold observation does not write settlement events.
- evidence write failure logs Chinese error and does not block claim creation.

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/unit/test_claim_engine.py -q -k evidence
```

Expected RED.

**Step 4: GREEN - ClaimEngine evidence**

In `ClaimEngine._process`:
- Record observation after delay source is known.
- Record condition matched before broadcasting `claim.triggered`.
- Record `claim.triggered` near existing broadcast.
- After `ClaimsService.create_claim`, compute `tx_hash`, refresh or query user balance if needed, then record `claim.settled`, `balance.credited`, `flight.landed` before the settlement transaction commit.
- Use `session.begin_nested()` or an equivalent savepoint for post-claim evidence writes so evidence failure rolls back only evidence rows while preserving claim creation, policy paid status, and balance credit.
- Pre-settlement observation / condition / trigger evidence may remain best-effort side effects, but must not poison core settlement flow.

**Step 5: verification**

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/unit/test_evidence_service.py backend/tests/unit/test_claim_engine.py backend/tests/integration/test_policies_routes.py -q
```

## Task 3: Backend Timeline API

**Files:**
- Create: `backend/evidence/routes.py`
- Modify: `backend/app.py`
- Create: `backend/tests/integration/test_evidence_routes.py`

**Step 1: RED - timeline routes**

Create integration tests for:
- `GET /policies/{policy_id}/timeline` returns owned policy timeline.
- `GET /claims/{claim_id}/timeline` returns full policy timeline and subject claim id.
- other-user policy and claim requests return 404.
- owned policy with no events returns `events: []`.

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/integration/test_evidence_routes.py -q
```

Expected RED: routes do not exist.

**Step 2: GREEN - route implementation**

Add `backend/evidence/routes.py` with authenticated endpoints:

```python
@router.get("/policies/{policy_id}/timeline", response_model=EvidenceTimelinePublic)
async def policy_timeline(policy_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]): ...

@router.get("/claims/{claim_id}/timeline", response_model=EvidenceTimelinePublic)
async def claim_timeline(claim_id: str, user: CurrentUser, session: Annotated[AsyncSession, Depends(get_session)]): ...
```

Include the router in `backend/app.py`.

**Step 3: verification**

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests/integration/test_evidence_routes.py backend/tests/integration/test_claims_routes.py backend/tests/integration/test_policies_routes.py -q
```

## Task 4: Frontend Hook And Evidence Drawer

**Files:**
- Create: `frontend/src/hooks/useEvidenceTimeline.ts`
- Create: `frontend/src/components/evidence/EvidenceDrawer.tsx`
- Create: `frontend/src/tests/evidence-drawer.test.tsx`
- Create: `frontend/src/tests/use-evidence-timeline.test.tsx`

**Step 1: RED - hook tests**

Test that:
- claim subject uses `/claims/{id}/timeline`.
- policy subject uses `/policies/{id}/timeline`.
- null subject does not fetch.

Run:

```bash
cd frontend && pnpm test -- use-evidence-timeline.test.tsx
```

Expected RED.

**Step 2: GREEN - hook**

Implement:

```ts
export type EvidenceSubject =
  | { kind: "claim"; id: string }
  | { kind: "policy"; id: string }
  | null;
```

Use SWR and `apiFetch<EvidenceTimeline>`.

**Step 3: RED - drawer tests**

Test loading, success, empty, error, close button, and Esc close. Mock `useEvidenceTimeline` instead of real network for component tests.

Run:

```bash
cd frontend && pnpm test -- evidence-drawer.test.tsx
```

Expected RED.

**Step 4: GREEN - drawer**

Implement a fixed-position drawer with existing CSS variables. Use button controls for close and payload details. Keep dimensions responsive and avoid nested cards.

**Step 5: verification**

Run:

```bash
cd frontend && pnpm test -- use-evidence-timeline.test.tsx evidence-drawer.test.tsx
```

## Task 5: Frontend Entry Points

**Files:**
- Modify: `frontend/src/components/claims/ClaimRow.tsx`
- Modify: `frontend/src/routes/ClaimsFeed.tsx`
- Modify: `frontend/src/components/hangar/HangarSlot.tsx`
- Modify: `frontend/src/routes/MyHangar.tsx`
- Modify: `frontend/src/components/flight/RelatedPolicies.tsx`
- Modify: `frontend/src/components/flight/RelatedClaims.tsx`
- Modify: `frontend/src/routes/FlightDetail.tsx`
- Modify/add tests under `frontend/src/tests/`

**Step 1: RED - ClaimRow evidence action**

Update `claim-row.test.tsx` to assert:
- clicking Evidence calls a provided `onEvidence({ kind: "claim", id })`.
- row navigation still works from non-Evidence click.
- Evidence click does not call navigate.

Run:

```bash
cd frontend && pnpm test -- claim-row.test.tsx
```

Expected RED.

**Step 2: GREEN - ClaimRow**

Add optional prop:

```ts
onEvidence?: (subject: { kind: "claim"; id: string }) => void;
```

Render a small `Evidence` button. Call `event.stopPropagation()` and `event.preventDefault()`.

**Step 3: RED/GREEN - HangarSlot evidence action**

Add similar optional prop for policy evidence:

```ts
onEvidence?: (subject: { kind: "policy"; id: string }) => void;
```

Test row navigation remains intact.

**Step 4: RED/GREEN - page integration**

ClaimsFeed, MyHangar, FlightDetail should hold `evidenceSubject` state and render one `EvidenceDrawer`. Pass handlers down through RelatedClaims/RelatedPolicies.

Extend page tests to assert drawer opens and route stays unchanged.

**Step 5: verification**

Run:

```bash
cd frontend && pnpm test -- claim-row.test.tsx MyHangar.test.tsx flight-detail.test.tsx evidence-drawer.test.tsx use-evidence-timeline.test.tsx
```

## Task 6: Final Verification

**Files:**
- Modify: `openspec/changes/add-settlement-evidence-replay/tasks.md`
- Possibly update: `README.md` only if implementation changes user-facing usage materially.

**Step 1: backend full tests**

Run:

```bash
/Users/captain/python/rialo-captain/.venv/bin/python -m pytest backend/tests -q
```

**Step 2: frontend tests and build**

Run:

```bash
cd frontend && pnpm test
cd frontend && pnpm build
```

**Step 3: OpenSpec validation**

Run:

```bash
openspec validate add-settlement-evidence-replay --strict --no-interactive
```

**Step 4: graphify rebuild**

Run if available:

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

If unavailable, record the import error and continue.

**Step 5: update task checklist**

Mark completed tasks in `openspec/changes/add-settlement-evidence-replay/tasks.md`.
