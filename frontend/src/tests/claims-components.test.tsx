import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClaimRow } from "../components/claims/ClaimRow";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import type { Claim } from "../hooks/useClaims";

const claims: Claim[] = [
  {
    id: "c1",
    policy_id: "policy-alpha-123",
    payout: 80,
    delay_minutes: 45,
    signature: "0xabcdef1234567890abcdef",
    settled_at: 1_800_000_000,
    settle_duration_ms: 118,
  },
  {
    id: "c2",
    policy_id: "policy-beta-456",
    payout: 20,
    delay_minutes: 30,
    signature: "0x9876543210abcdef9876",
    settled_at: 1_800_000_060,
    settle_duration_ms: 76,
  },
];

describe("claims components", () => {
  it("summarizes session payout and claim count in the hero counter", () => {
    render(<ClaimsHeroCounter claims={claims} />);

    expect(screen.getByText("SESSION AUTO-SETTLED")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("RIA")).toBeInTheDocument();
    expect(
      screen.getByText("2 claims, paid by reactive contract"),
    ).toBeInTheDocument();
  });

  it("renders a claim row with policy, settlement time, delay, payout, and signature", () => {
    render(<ClaimRow c={claims[0]} />);

    expect(screen.getByText("policy-alp…")).toBeInTheDocument();
    expect(
      screen.getByText(new Date(claims[0].settled_at * 1000).toLocaleTimeString()),
    ).toBeInTheDocument();
    expect(screen.getByText("45m late")).toBeInTheDocument();
    expect(screen.getByText("+80 RIA")).toBeInTheDocument();
    expect(screen.getByText("0xabcdef1234567890… (118ms)")).toBeInTheDocument();
  });
});
