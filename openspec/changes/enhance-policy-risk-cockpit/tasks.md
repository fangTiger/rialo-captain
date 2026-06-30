## 1. Backend Risk Projection

- [x] 1.1 Add focused tests for `GET /policies` preserving existing fields while returning risk projection fields.
- [x] 1.2 Add tests for active policy risk levels: `triggered`, `watch`, `normal`, and `unknown`.
- [x] 1.3 Add tests proving paid policies return `settled`, expired policies return `inactive`, and non-active policies have no trigger countdown.
- [x] 1.4 Extract or reuse live delay calculation so policy risk projection matches Flight Detail delay behavior.
- [x] 1.5 Extend `PolicyPublic` and policy listing response with `delay_threshold_minutes`, `live_delay_minutes`, `minutes_until_trigger`, `risk_level`, and `risk_reason`.
- [x] 1.6 Add regression coverage proving ClaimEngine does not use policy risk projection fields for settlement decisions.

## 2. Frontend Policy Types And Utilities

- [x] 2.1 Update `frontend/src/hooks/usePolicies.ts` Policy type with optional risk projection fields and safe fallbacks.
- [x] 2.2 Add pure utility tests for Hangar summary totals: active exposure, max potential payout, settled payout, and at-risk count.
- [x] 2.3 Add pure utility tests for active policy sorting by risk priority, payout, and created time.
- [x] 2.4 Implement shared Hangar risk helpers without introducing new runtime dependencies.

## 3. My Hangar Risk Cockpit

- [x] 3.1 Add failing tests for My Hangar risk summary band rendering non-empty and empty states.
- [x] 3.2 Add failing tests proving ACTIVE lane uses risk-priority ordering.
- [x] 3.3 Add failing tests proving HangarSlot renders risk level, live delay, threshold distance, and fallback text for unknown delay.
- [x] 3.4 Implement My Hangar summary band using existing design tokens and compact dashboard layout.
- [x] 3.5 Implement HangarSlot risk strip while preserving card navigation, Evidence action, and Copilot action behavior.

## 4. Flight Detail Quote And Holding Summary

- [x] 4.1 Add tests proving InsureBlock shows premium tier, multiplier, delay rate, estimated payout, coverage condition, and automatic settlement explanation.
- [x] 4.2 Add tests proving estimated payout updates when premium changes.
- [x] 4.3 Add tests proving existing active policies replace the purchase button with active holding summary.
- [x] 4.4 Add tests proving active holding summary aggregates premium and payout, chooses highest risk level, and opens Evidence without route changes.
- [x] 4.5 Update FlightDetail to pass current-flight active policy details into InsureBlock.
- [x] 4.6 Implement InsureBlock quote explanation and active holding summary with safe degraded behavior for missing flight data.

## 5. Verification And Spec Hygiene

- [x] 5.1 Run backend focused tests for policy routes/services and ClaimEngine regression.
- [x] 5.2 Run frontend focused tests for MyHangar, HangarSlot, FlightDetail, InsureBlock, and policy risk utilities.
- [x] 5.3 Run broader backend and frontend suites where feasible; document any pre-existing failures separately.
- [x] 5.4 Run `openspec validate enhance-policy-risk-cockpit --strict --no-interactive`.
- [x] 5.5 Rebuild graphify code graph after implementation code changes.
- [x] 5.6 Update this tasks file to reflect completed implementation work before archive.
