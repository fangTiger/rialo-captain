import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimRow } from "../components/claims/ClaimRow";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import type { Claim } from "../hooks/useClaims";

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
}));

const claimTimeFormatterOptions: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
};
const hanTextPattern = /\p{Script=Han}/u;

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

const claims: Claim[] = [
  {
    id: "c1",
    policy_id: "policy-alpha-123",
    flight_id: "BA178-20260614",
    payout: 80,
    delay_minutes: 45,
    signature: "0xabcdef1234567890abcdef",
    settled_at: 1_800_000_000,
    settle_duration_ms: 118,
  },
  {
    id: "c2",
    policy_id: "policy-beta-456",
    flight_id: "DL101-20260614",
    payout: 20,
    delay_minutes: 30,
    signature: "0x9876543210abcdef9876",
    settled_at: 1_800_000_060,
    settle_duration_ms: 76,
  },
];

describe("claims components", () => {
  beforeEach(() => {
    copilotHarness.ask.mockReset();
  });

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
    const expectedTime = new Intl.DateTimeFormat(
      "en-US",
      claimTimeFormatterOptions,
    ).format(new Date(claims[0].settled_at * 1000));
    const originalToLocaleTimeString = Date.prototype.toLocaleTimeString;
    const toLocaleTimeStringSpy = vi
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockImplementation(function (
        this: Date,
        locales?: Intl.LocalesArgument,
        options?: Intl.DateTimeFormatOptions,
      ) {
        if (locales === undefined) {
          return "下午2:13:20";
        }
        return originalToLocaleTimeString.call(this, locales, options);
      });

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ClaimRow c={claims[0]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("policy-alp…")).toBeInTheDocument();
    expect(screen.getByText(expectedTime)).toBeInTheDocument();
    expect(expectedTime).not.toMatch(hanTextPattern);
    expect(screen.queryByText("下午2:13:20")).not.toBeInTheDocument();
    expect(screen.getByText("45m late")).toBeInTheDocument();
    expect(screen.getByText("+80 RIA")).toBeInTheDocument();
    expect(screen.getByText("0xabcdef1234567890… (118ms)")).toBeInTheDocument();

    toLocaleTimeStringSpy.mockRestore();
  });
});
