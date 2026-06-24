## 1. Backend Evidence Foundation

- [x] 1.1 Add `PolicyEvent` model and database coverage for the `policy_events` table.
- [x] 1.2 Add evidence schemas and `EvidenceService` for recording events and querying policy/claim timelines.
- [x] 1.3 Add unit tests for event ordering, payload parsing, empty timeline, and policy ownership checks.

## 2. Backend Flow Integration

- [x] 2.1 Record `policy.created` and `contract.watched` events during successful `POST /policies`.
- [x] 2.2 Record observation, condition matched, claim triggered, claim settled, balance credited, and flight landed events in `ClaimEngine`.
- [x] 2.3 Keep evidence write failures from blocking successful settlement, with Chinese error logging and regression tests.

## 3. Backend Timeline API

- [x] 3.1 Add `GET /policies/{policy_id}/timeline` for authenticated policy owners.
- [x] 3.2 Add `GET /claims/{claim_id}/timeline` for authenticated claim owners.
- [x] 3.3 Add integration tests for success, empty timeline, unauthorized access hidden as 404, and unknown resources.

## 4. Frontend Evidence Drawer

- [x] 4.1 Add `useEvidenceTimeline` hook and API client types for policy/claim timelines.
- [x] 4.2 Add `EvidenceDrawer` with loading, success, empty, error, payload summary, Esc close, and close button states.
- [x] 4.3 Add Vitest coverage for drawer states and hook request path selection.

## 5. Frontend Entry Points

- [x] 5.1 Add Evidence action to `ClaimRow` without breaking existing row navigation.
- [x] 5.2 Add Evidence action to My Hangar policy cards and FlightDetail related policy/claim areas.
- [x] 5.3 Add interaction tests proving Evidence actions open the drawer and do not change routes unexpectedly.

## 6. Verification And Spec Hygiene

- [x] 6.1 Run backend focused tests and full backend test suite. Focused tests pass; full backend suite still has the existing Vercel `FakeOpenSky.fetch_all` failures.
- [x] 6.2 Run frontend focused tests and full frontend Vitest suite. Focused tests pass; full suite was run in the worktree and the only failure reproduces on a clean main temp worktree when `node_modules` is symlinked.
- [x] 6.3 Run frontend build if frontend implementation touches shared types or route components.
- [x] 6.4 Run `openspec validate add-settlement-evidence-replay --strict --no-interactive`.
- [x] 6.5 Update tasks.md checkboxes to match completed work and rebuild graphify code graph after code changes.
