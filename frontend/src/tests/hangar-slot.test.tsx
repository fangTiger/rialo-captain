import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HangarSlot } from "../components/hangar/HangarSlot";
import type { Policy } from "../hooks/usePolicies";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

const navigateMock = vi.hoisted(() => vi.fn());
const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

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
  options: {
    policy?: Policy;
    onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
  } = {},
) {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <HangarSlot p={options.policy ?? policy} onEvidence={options.onEvidence} />
    </MemoryRouter>,
  );
  return screen.getByRole("button", {
    name: new RegExp(`^open flight ${options.policy?.flight_id ?? policy.flight_id}$`, "i"),
  });
}

function getEvidenceButton() {
  return screen.getByRole("button", {
    name: /view evidence for policy p1/i,
  });
}

describe("HangarSlot", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    copilotHarness.ask.mockReset();
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
    renderHangarSlot({ onEvidence });

    const evidenceButton = getEvidenceButton();

    expect(evidenceButton).toHaveTextContent("Evidence");

    fireEvent.click(evidenceButton);

    expect(onEvidence).toHaveBeenCalledWith({ kind: "policy", id: "p1" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("cancels repeated Enter and Space keydown events on the row container without navigating", () => {
    const slot = renderHangarSlot();

    fireEvent.keyDown(slot, { key: "Enter" });
    const repeatedEnter = createEvent.keyDown(slot, { key: "Enter", repeat: true });
    fireEvent(slot, repeatedEnter);
    fireEvent.keyDown(slot, { key: " " });
    const repeatedSpace = createEvent.keyDown(slot, { key: " ", repeat: true });
    fireEvent(slot, repeatedSpace);

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
    expect(navigateMock).toHaveBeenCalledTimes(2);
    expect(repeatedEnter.defaultPrevented).toBe(true);
    expect(repeatedSpace.defaultPrevented).toBe(true);
  });

  it("does not trigger row navigation when the Evidence button receives keyboard input", () => {
    const onEvidence = vi.fn();
    renderHangarSlot({ onEvidence });

    const evidenceButton = getEvidenceButton();

    fireEvent.keyDown(evidenceButton, { key: "Enter" });
    fireEvent.keyDown(evidenceButton, { key: " " });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(onEvidence).not.toHaveBeenCalled();

    fireEvent.click(evidenceButton);

    expect(onEvidence).toHaveBeenCalledWith({ kind: "policy", id: "p1" });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("renders risk level, live delay, and threshold distance for projected active policies", () => {
    renderHangarSlot({
      policy: {
        ...policy,
        risk_level: "watch",
        delay_threshold_minutes: 30,
        live_delay_minutes: 24,
        minutes_until_trigger: 6,
        risk_reason: "Delay sits inside the watch band.",
      },
    });

    expect(screen.getByText("WATCH")).toBeInTheDocument();
    expect(screen.getByText("Live delay +24m")).toBeInTheDocument();
    expect(screen.getByText("6m to 30m threshold")).toBeInTheDocument();
    expect(
      screen.getByText("Delay sits inside the watch band."),
    ).toBeInTheDocument();
  });

  it("renders fallback text when live delay is unavailable", () => {
    renderHangarSlot({
      policy: {
        ...policy,
        risk_level: "unknown",
        delay_threshold_minutes: 30,
        live_delay_minutes: null,
        minutes_until_trigger: null,
      },
    });

    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getByText("Live delay unavailable")).toBeInTheDocument();
    expect(screen.getByText("30m threshold unavailable")).toBeInTheDocument();
  });

  it("renders threshold reached text when the active policy has reached the trigger boundary", () => {
    renderHangarSlot({
      policy: {
        ...policy,
        risk_level: "triggered",
        delay_threshold_minutes: 30,
        live_delay_minutes: 31,
        minutes_until_trigger: 0,
        risk_reason: "Delay crossed trigger threshold.",
      },
    });

    expect(screen.getByText("TRIGGERED")).toBeInTheDocument();
    expect(screen.getByText("30m threshold reached")).toBeInTheDocument();
  });
});
