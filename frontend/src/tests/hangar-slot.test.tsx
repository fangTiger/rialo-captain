import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HangarSlot } from "../components/hangar/HangarSlot";
import type { Policy } from "../hooks/usePolicies";
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

const policy: Policy = {
  id: "p1",
  flight_id: "BA178-20260614",
  premium: 10,
  payout: 80,
  status: "active",
  contract_ref: "mock-policy-one",
  created_at: 1,
};

function renderHangarSlot(
  onEvidence?: (subject: NonNullable<EvidenceSubject>) => void,
) {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <HangarSlot p={policy} onEvidence={onEvidence} />
    </MemoryRouter>,
  );
  return screen.getByRole("button", { name: /^open flight BA178-20260614$/i });
}

function getEvidenceButton() {
  return screen.getByRole("button", {
    name: /view evidence for policy p1/i,
  });
}

describe("HangarSlot", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates to the policy flight with hangar breadcrumb state when clicked", () => {
    const slot = renderHangarSlot();

    fireEvent.click(slot);

    expect(navigateMock).toHaveBeenCalledWith("/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
  });

  it("calls the evidence handler without navigating when Evidence is clicked", () => {
    const onEvidence = vi.fn();
    renderHangarSlot(onEvidence);

    const evidenceButton = getEvidenceButton();

    expect(evidenceButton).toHaveTextContent("Evidence");

    fireEvent.click(evidenceButton);

    expect(onEvidence).toHaveBeenCalledWith({ kind: "policy", id: "p1" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("ignores repeated Enter and Space keydown events on the row container", () => {
    const slot = renderHangarSlot();

    fireEvent.keyDown(slot, { key: "Enter" });
    fireEvent.keyDown(slot, { key: "Enter", repeat: true });
    fireEvent.keyDown(slot, { key: " " });
    fireEvent.keyDown(slot, { key: " ", repeat: true });

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
    expect(navigateMock).toHaveBeenCalledTimes(2);
  });

  it("does not trigger row navigation when the Evidence button receives keyboard input", () => {
    const onEvidence = vi.fn();
    renderHangarSlot(onEvidence);

    const evidenceButton = getEvidenceButton();

    fireEvent.keyDown(evidenceButton, { key: "Enter" });
    fireEvent.keyDown(evidenceButton, { key: " " });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(onEvidence).not.toHaveBeenCalled();

    fireEvent.click(evidenceButton);

    expect(onEvidence).toHaveBeenCalledWith({ kind: "policy", id: "p1" });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
