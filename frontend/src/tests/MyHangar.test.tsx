import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { MyHangar } from "../routes/MyHangar";
import { useEventStore } from "../store/eventStore";

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("../components/evidence/EvidenceDrawer", () => ({
  EvidenceDrawer: ({
    subject,
    onClose,
  }: {
    subject: EvidenceSubject;
    onClose: () => void;
  }) =>
    subject ? (
      <div data-testid="evidence-drawer">
        <span>{`${subject.kind}:${subject.id}`}</span>
        <button type="button" onClick={onClose}>
          Close evidence drawer
        </button>
      </div>
    ) : null,
}));

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

let policiesPayload: Array<Record<string, unknown>> = [];

describe("MyHangar", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    policiesPayload = [
      {
        id: "p1",
        flight_id: "BA178-20260614",
        premium: 10,
        payout: 80,
        status: "active",
        contract_ref: "mock-policy-one",
        created_at: 1,
      },
      {
        id: "p2",
        flight_id: "DL101-20260614",
        premium: 5,
        payout: 30,
        status: "paid",
        contract_ref: "mock-policy-two",
        created_at: 2,
      },
      {
        id: "p3",
        flight_id: "UA200-20260614",
        premium: 20,
        payout: 120,
        status: "expired",
        contract_ref: "mock-policy-three",
        created_at: 3,
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          new Response(JSON.stringify(policiesPayload), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    copilotHarness.ask.mockReset();
    copilotHarness.openPanel.mockReset();
  });

  it("groups policies into active, paid, and expired hangar lanes", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <MyHangar />
        </SWRConfig>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    expect(screen.getByRole("heading", { name: /^ACTIVE/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^PAID/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^EXPIRED/i })).toBeInTheDocument();
    expect(screen.getByText("DL101-20260614")).toBeInTheDocument();
    expect(screen.getByText("UA200-20260614")).toBeInTheDocument();
    expect(screen.getAllByText("10 RIA").length).toBeGreaterThan(0);
    expect(screen.getByText("120 RIA")).toBeInTheDocument();
  });

  it("renders the hangar risk summary band for non-empty holdings", async () => {
    policiesPayload = [
      {
        id: "p1",
        flight_id: "BA178-20260614",
        premium: 10,
        payout: 80,
        status: "active",
        contract_ref: "mock-policy-one",
        created_at: 1,
        risk_level: "triggered",
        delay_threshold_minutes: 30,
        live_delay_minutes: 45,
        minutes_until_trigger: 0,
        risk_reason: "Delay crossed trigger threshold.",
      },
      {
        id: "p2",
        flight_id: "DL101-20260614",
        premium: 12,
        payout: 40,
        status: "active",
        contract_ref: "mock-policy-two",
        created_at: 2,
        risk_level: "normal",
        delay_threshold_minutes: 30,
        live_delay_minutes: 8,
        minutes_until_trigger: 22,
        risk_reason: "Delay remains below watch band.",
      },
      {
        id: "p3",
        flight_id: "UA200-20260614",
        premium: 20,
        payout: 30,
        status: "paid",
        contract_ref: "mock-policy-three",
        created_at: 3,
        risk_level: "settled",
        delay_threshold_minutes: 30,
        live_delay_minutes: null,
        minutes_until_trigger: null,
        risk_reason: "Policy already settled.",
      },
    ];

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <MyHangar />
        </SWRConfig>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    const summary = screen.getByRole("region", { name: /hangar risk summary/i });

    expect(within(summary).getByText("ACTIVE EXPOSURE")).toBeInTheDocument();
    expect(within(summary).getByText("MAX POTENTIAL PAYOUT")).toBeInTheDocument();
    expect(within(summary).getByText("SETTLED PAYOUT")).toBeInTheDocument();
    expect(within(summary).getByText("AT RISK")).toBeInTheDocument();
    expect(within(summary).getByText("22 RIA")).toBeInTheDocument();
    expect(within(summary).getByText("120 RIA")).toBeInTheDocument();
    expect(within(summary).getByText("30 RIA")).toBeInTheDocument();
    expect(within(summary).getByText("1 policy")).toBeInTheDocument();
  });

  it("renders zeroed summary values and keeps empty lanes visible", async () => {
    policiesPayload = [];

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <MyHangar />
        </SWRConfig>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("ACTIVE")).toBeInTheDocument(),
    );

    const summary = screen.getByRole("region", { name: /hangar risk summary/i });

    expect(within(summary).getAllByText("0 RIA")).toHaveLength(3);
    expect(within(summary).getByText("0 policies")).toBeInTheDocument();
    expect(screen.getAllByText("none")).toHaveLength(3);
  });

  it("orders active policies by risk priority, payout, and created time", async () => {
    policiesPayload = [
      {
        id: "p1",
        flight_id: "NORMAL-20260614",
        premium: 10,
        payout: 999,
        status: "active",
        contract_ref: "mock-policy-one",
        created_at: 1,
        risk_level: "normal",
      },
      {
        id: "p2",
        flight_id: "WATCH-SAME-PAYOUT-OLDER-20260614",
        premium: 10,
        payout: 120,
        status: "active",
        contract_ref: "mock-policy-two",
        created_at: 2,
        risk_level: "watch",
      },
      {
        id: "p6",
        flight_id: "WATCH-HIGH-PAYOUT-20260614",
        premium: 10,
        payout: 180,
        status: "active",
        contract_ref: "mock-policy-six",
        created_at: 1,
        risk_level: "watch",
      },
      {
        id: "p3",
        flight_id: "TRIGGERED-20260614",
        premium: 10,
        payout: 40,
        status: "active",
        contract_ref: "mock-policy-three",
        created_at: 3,
        risk_level: "triggered",
      },
      {
        id: "p4",
        flight_id: "UNKNOWN-20260614",
        premium: 10,
        payout: 200,
        status: "active",
        contract_ref: "mock-policy-four",
        created_at: 4,
        risk_level: "unknown",
      },
      {
        id: "p5",
        flight_id: "WATCH-SAME-PAYOUT-NEWER-20260614",
        premium: 10,
        payout: 120,
        status: "active",
        contract_ref: "mock-policy-five",
        created_at: 5,
        risk_level: "watch",
      },
    ];

    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <MyHangar />
        </SWRConfig>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("TRIGGERED-20260614")).toBeInTheDocument(),
    );

    expect(
      screen
        .getAllByRole("button", { name: /open flight/i })
        .map((row) => row.getAttribute("aria-label")),
    ).toEqual([
      "Open flight TRIGGERED-20260614",
      "Open flight WATCH-HIGH-PAYOUT-20260614",
      "Open flight WATCH-SAME-PAYOUT-NEWER-20260614",
      "Open flight WATCH-SAME-PAYOUT-OLDER-20260614",
      "Open flight UNKNOWN-20260614",
      "Open flight NORMAL-20260614",
    ]);
  });

  it("opens policy evidence without changing the current route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter
          initialEntries={["/policies"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route
              path="/policies"
              element={
                <>
                  <LocationProbe />
                  <MyHangar />
                </>
              }
            />
            <Route path="/flight/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /view evidence for policy p1/i }),
    );

    expect(screen.getByTestId("evidence-drawer")).toHaveTextContent(
      "policy:p1",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent("/policies");
  });

  it("asks Rialo about a policy without opening the flight route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter
          initialEntries={["/policies"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route
              path="/policies"
              element={
                <>
                  <LocationProbe />
                  <MyHangar />
                </>
              }
            />
            <Route path="/flight/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Explain this policy" })[0],
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith({
      question: "Explain this policy",
      subjectType: "policy",
      subjectId: "p1",
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent("/policies");
  });
});
