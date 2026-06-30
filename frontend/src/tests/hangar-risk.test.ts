import { describe, expect, it } from "vitest";
import {
  sortActivePolicies,
  summarizeHangarPolicies,
} from "../components/hangar/risk";
import type { Policy } from "../hooks/usePolicies";

function makePolicy(overrides: Partial<Policy> & Record<string, unknown>): Policy {
  return {
    id: "p1",
    flight_id: "BA178-20260614",
    premium: 10,
    payout: 80,
    status: "active",
    contract_ref: "mock-policy-one",
    created_at: 1,
    ...overrides,
  } as Policy;
}

describe("hangar risk helpers", () => {
  it("calculates active exposure, max potential payout, settled payout, and at-risk count", () => {
    const summary = summarizeHangarPolicies([
      makePolicy({
        id: "active-triggered",
        premium: 12,
        payout: 90,
        risk_level: "triggered",
      }),
      makePolicy({
        id: "active-watch",
        premium: 8,
        payout: 60,
        risk_level: "watch",
      }),
      makePolicy({
        id: "active-normal",
        premium: 5,
        payout: 20,
        risk_level: "normal",
      }),
      makePolicy({
        id: "paid-settled",
        status: "paid",
        premium: 3,
        payout: 44,
        risk_level: "settled",
      }),
      makePolicy({
        id: "expired-inactive",
        status: "expired",
        premium: 7,
        payout: 100,
        risk_level: "inactive",
      }),
    ]);

    expect(summary).toEqual({
      activeExposure: 25,
      maxPotentialPayout: 170,
      settledPayout: 44,
      atRiskCount: 2,
    });
  });

  it("sorts active policies by risk priority, payout descending, and created time descending", () => {
    const ordered = sortActivePolicies([
      makePolicy({
        id: "normal-big-payout",
        flight_id: "NORMAL-20260614",
        payout: 500,
        created_at: 1,
        risk_level: "normal",
      }),
      makePolicy({
        id: "watch-same-payout-older",
        flight_id: "WATCH-SAME-PAYOUT-OLDER-20260614",
        payout: 120,
        created_at: 4,
        risk_level: "watch",
      }),
      makePolicy({
        id: "watch-high-payout",
        flight_id: "WATCH-HIGH-PAYOUT-20260614",
        payout: 180,
        created_at: 3,
        risk_level: "watch",
      }),
      makePolicy({
        id: "triggered-low-payout",
        flight_id: "TRIGGERED-20260614",
        payout: 10,
        created_at: 2,
        risk_level: "triggered",
      }),
      makePolicy({
        id: "watch-newer",
        flight_id: "WATCH-SAME-PAYOUT-NEWER-20260614",
        payout: 120,
        created_at: 8,
        risk_level: "watch",
      }),
      makePolicy({
        id: "unknown-mid-payout",
        flight_id: "UNKNOWN-20260614",
        payout: 300,
        created_at: 9,
        risk_level: "unknown",
      }),
    ]);

    expect(ordered.map((policy) => policy.flight_id)).toEqual([
      "TRIGGERED-20260614",
      "WATCH-HIGH-PAYOUT-20260614",
      "WATCH-SAME-PAYOUT-NEWER-20260614",
      "WATCH-SAME-PAYOUT-OLDER-20260614",
      "UNKNOWN-20260614",
      "NORMAL-20260614",
    ]);
  });
});
