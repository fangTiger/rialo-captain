## 1. Demo Director State

- [x] 1.1 Add focused failing tests for Guided Demo state transitions: idle -> select flight -> buy cover -> replay -> exit.
- [x] 1.2 Add failing tests proving closing BuyDrawer pauses/resumes the same selected flight and does not create a policy.
- [x] 1.3 Implement small frontend state helpers for Guided Demo without adding runtime dependencies.

## 2. Demo Rail UI

- [x] 2.1 Add failing component tests for the `Start guided demo`, `Resume`, and `Exit demo` controls.
- [x] 2.2 Implement a compact Demo Rail component that shows step progress, selected/recommended flight, and replay status.
- [x] 2.3 Ensure Demo Rail layout does not block GlobeMap interactions and remains usable at narrow widths.

## 3. Tower Integration

- [x] 3.1 Add failing TowerShell tests proving starting the guided demo recommends/highlights a flight and does not call `POST /policies`.
- [x] 3.2 Add failing TowerShell tests proving clicking the recommended or any other flight opens BuyDrawer and moves the rail to `Buy cover`.
- [x] 3.3 Add failing TowerShell tests proving closing BuyDrawer preserves demo context and `Resume` reopens the selected flight.
- [x] 3.4 Add failing TowerShell tests proving purchase success moves to `Settlement replay`, keeps the selected policy context, and routes the purchase as REAL protagonist.
- [x] 3.5 Implement TowerShell integration using existing `chooseDemoProtagonist`, `BuyDrawer`, `AutoSeeder demoLocked`, and purchase timeline code.

## 4. Manual Operation And Cinema Compatibility

- [x] 4.1 Add regression tests proving map gestures/manual viewing do not exit Guided Demo.
- [x] 4.2 Add regression tests proving selecting a different flight during Guided Demo replaces the demo subject without remounting CinemaProvider.
- [x] 4.3 Verify existing purchase fallback event idempotence is preserved; add focused coverage only if current tests do not protect it.

## 5. Verification And Spec Hygiene

- [x] 5.1 Run focused frontend tests for demo director, TowerShell, BuyDrawer, and Cinema UI.
- [x] 5.2 Run broader frontend Vitest suite or document any pre-existing failures.
- [x] 5.3 Run `openspec validate add-guided-demo-director --strict --no-interactive`.
- [x] 5.4 Rebuild graphify code graph after implementation code changes.
- [x] 5.5 Update this tasks file checkboxes to match completed implementation work.
