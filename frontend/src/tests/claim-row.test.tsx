import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimRow } from "../components/claims/ClaimRow";
import type { Claim } from "../hooks/useClaims";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const claim: Claim = {
  id: "c1",
  policy_id: "policy-alpha-123",
  flight_id: "BA178-20260614",
  payout: 80,
  delay_minutes: 45,
  signature: "0xabcdef1234567890abcdef",
  settled_at: 1_800_000_000,
  settle_duration_ms: 118,
};

function renderClaimRow(onEvidence?: (subject: NonNullable<EvidenceSubject>) => void) {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <ClaimRow c={claim} onEvidence={onEvidence} />
    </MemoryRouter>,
  );
  return screen.getByRole("button", { name: /policy-alpha-123/i });
}

describe("ClaimRow", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates to the claim flight with claims breadcrumb state when clicked", () => {
    const row = renderClaimRow();

    fireEvent.click(row);

    expect(navigateMock).toHaveBeenCalledWith("/flight/BA178-20260614", {
      state: { from: "/claims" },
    });
  });

  it("calls the evidence handler without navigating when Evidence is clicked", () => {
    const onEvidence = vi.fn();
    renderClaimRow(onEvidence);

    fireEvent.click(screen.getByRole("button", { name: /^evidence$/i }));

    expect(onEvidence).toHaveBeenCalledWith({ kind: "claim", id: "c1" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("uses the same navigation for Enter and Space", () => {
    const row = renderClaimRow();

    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/flight/BA178-20260614", {
      state: { from: "/claims" },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/flight/BA178-20260614", {
      state: { from: "/claims" },
    });
  });
});
