# Demo Scenario Replay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build demo-only page interactions for scenario selection, settlement replay, evidence story playback, and read-only Copilot prompts without adding real-chain, payment, production-login, or real-data-source behavior.

**Architecture:** Extend the existing Guided Demo frontend state machine and Rail UI. Reuse TowerShell's local post-purchase visual timeline for replay. Add Evidence Drawer local playback controls over the existing persisted timeline API data.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, existing Zustand event store and existing Copilot prompt chip.

---

## Constraints

- Do not modify backend APIs unless a test proves a frontend-only approach is impossible.
- Do not disable or hide dev login.
- Do not change Copilot provider configuration or introduce fake/offline AI behavior.
- Do not create policy/claim/balance updates from scenario picker or replay controls.
- Use TDD: write failing test, run it, implement minimal change, run passing test.
- Do not revert user changes. Check `git status --short` before editing and before final report.

## Task 1: Scenario State Model

**Files:**

- Modify: `frontend/src/components/demo/demoDirector.ts`
- Test: `frontend/src/tests/guided-demo-director.test.ts`

**Step 1: Write failing tests**

Add tests for:

- `createIdleGuidedDemoState()` includes default scenario `smooth-payout`.
- `selectGuidedDemoScenario(state, "evidence-deep-dive")` changes only scenario fields and does not create selected flight or policy.
- Starting a guided demo preserves the selected scenario.
- Completing purchase increments or initializes a replay token suitable for visual replay.

**Step 2: Run red test**

Run:

```bash
cd frontend && npm test -- guided-demo-director
```

Expected: FAIL because scenario APIs or fields do not exist.

**Step 3: Implement minimal model**

Add:

- `GuidedDemoScenarioId = "smooth-payout" | "at-risk-flight" | "evidence-deep-dive"`
- `DEMO_SCENARIOS` with stable English labels, short goals, and next-action copy.
- `selectedScenarioId` and `replayToken` in `GuidedDemoState`.
- `selectGuidedDemoScenario(state, scenarioId)`.
- `requestGuidedDemoReplay(state)` to increment replay token only when purchased policy exists.

Keep existing state transitions compatible.

**Step 4: Run green test**

Run:

```bash
cd frontend && npm test -- guided-demo-director
```

Expected: PASS.

## Task 2: Scenario Picker And Demo Prompts In Rail

**Files:**

- Modify: `frontend/src/components/demo/GuidedDemoRail.tsx`
- Test: `frontend/src/tests/guided-demo-rail.test.tsx`

**Step 1: Write failing tests**

Add tests proving:

- Rail renders scenario controls for `Smooth payout`, `At risk flight`, and `Evidence deep dive`.
- Selecting a scenario calls `onSelectScenario` and updates visible scenario goal in rerendered state.
- Rail shows `Replay settlement` after purchase and calls `onReplaySettlement`.
- Rail shows a demo Copilot prompt chip or button that only calls `onAskScenario`.
- Existing narrow layout and `pointer-events` behavior remain unchanged.

**Step 2: Run red test**

Run:

```bash
cd frontend && npm test -- guided-demo-rail
```

Expected: FAIL because the new controls are absent.

**Step 3: Implement Rail UI**

Add props:

- `onSelectScenario(scenarioId)`
- `onReplaySettlement()`
- `onAskScenario()`

Render compact scenario buttons or segmented control inside the Rail. Keep width stable at `min(100%, 21rem)`. Use existing `railButtonStyle` and inline tokens; no new dependencies.

**Step 4: Run green test**

Run:

```bash
cd frontend && npm test -- guided-demo-rail
```

Expected: PASS.

## Task 3: Tower Replay Integration

**Files:**

- Modify: `frontend/src/routes/TowerShell.tsx`
- Test: `frontend/src/tests/tower-shell.test.tsx`

**Step 1: Write failing tests**

Add TowerShell tests proving:

- Selecting a demo scenario updates the Rail without opening BuyDrawer or calling purchase.
- After purchase, clicking `Replay settlement` schedules another visual replay for the same policy and increments visible replay state.
- Replay does not call `POST /policies`; in the existing BuyDrawer mock, `purchaseRequests` remains unchanged after replay.
- Replay uses the selected flight/policy context and does not exit Guided Demo.
- Scenario prompt calls Copilot ask with `openPanel: false` or equivalent read-only behavior and does not open the panel.

**Step 2: Run red test**

Run:

```bash
cd frontend && npm test -- tower-shell
```

Expected: FAIL because TowerShell does not wire scenario/replay controls.

**Step 3: Implement replay token wiring**

Use the new `selectGuidedDemoScenario` and `requestGuidedDemoReplay` helpers. Pass scenario/replay callbacks to `GuidedDemoRail`.

In `TowerCinemaLayers`:

- Add a `replayToken` prop from guided state.
- Include `replayToken` in the post-purchase timeline scheduling effect dependency.
- Allow replay for the same `purchasedPolicy.id` when `replayToken` changes.
- Continue checking `hasPolicyEvent(type, policyId)` before adding fallback events.
- Do not change backend calls.

**Step 4: Run green test**

Run:

```bash
cd frontend && npm test -- tower-shell
```

Expected: PASS.

## Task 4: Evidence Story Playback

**Files:**

- Modify: `frontend/src/components/evidence/EvidenceDrawer.tsx`
- Test: `frontend/src/tests/evidence-drawer.test.tsx`

**Step 1: Write failing tests**

Add tests proving:

- With two or more events, Drawer shows `Play evidence story`, `Previous evidence event`, `Next evidence event`, and `1 / N`.
- Clicking Next highlights the second event and updates counter.
- Clicking Play advances the highlighted event using fake timers; Pause stops advancement.
- Empty/error/loading states do not show playback controls.
- Existing focus trap, Escape close, and Copilot evidence chip still work.

**Step 2: Run red test**

Run:

```bash
cd frontend && npm test -- evidence-drawer
```

Expected: FAIL because story controls are absent.

**Step 3: Implement Drawer story controls**

Add local state:

- `activeEventIndex`
- `isStoryPlaying`

Reset index/playback when `drawerKey` or event count changes. Use `window.setInterval` or `setTimeout` and clean it up on pause/unmount. Add `data-active-story-event="true"` or `aria-current="step"` to the highlighted event row.

Do not re-fetch timeline when changing active event.

**Step 4: Run green test**

Run:

```bash
cd frontend && npm test -- evidence-drawer
```

Expected: PASS.

## Task 5: Focused Verification

**Files:**

- Update: `openspec/changes/add-demo-scenario-replay/tasks.md`

**Step 1: Run focused tests**

Run:

```bash
cd frontend && npm test -- guided-demo-director guided-demo-rail tower-shell evidence-drawer
```

Expected: PASS.

**Step 2: Run OpenSpec validation**

Run:

```bash
openspec validate add-demo-scenario-replay --strict --no-interactive
```

Expected: `Change 'add-demo-scenario-replay' is valid`.

**Step 3: Run broader frontend test or document failure**

Run:

```bash
cd frontend && npm test
```

If it fails, capture the first failing tests and determine whether they are introduced by this change.

**Step 4: Rebuild graphify**

Run after code changes:

```bash
python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

If graphify is unavailable, record the exact error and continue.

**Step 5: Mark tasks**

Update `openspec/changes/add-demo-scenario-replay/tasks.md` checkboxes to reflect verified work only.
