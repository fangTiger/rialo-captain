import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { InsureBlock } from "../components/flight/InsureBlock";
import type { Policy } from "../hooks/usePolicies";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { useEventStore } from "../store/eventStore";

const refreshPoliciesMock = vi.hoisted(() => vi.fn());
const refreshMeMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../hooks/usePolicies", () => ({
  usePolicies: () => ({
    policies: [],
    refresh: refreshPoliciesMock,
  }),
}));

vi.mock("../hooks/useMe", () => ({
  useMe: () => ({
    user: null,
    refresh: refreshMeMock,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderInsureBlock(
  fromState: { from: string } | null,
  options: {
    delayRate?: number | null;
    activePolicies?: Policy[];
    onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
  } = {},
) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/flight/BA178-20260614", state: fromState }]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route
          path="/flight/:id"
          element={
            <>
              <InsureBlock
                flightId="BA178-20260614"
                callsign="BA178"
                delayRate={
                  options.delayRate === undefined ? 0.25 : options.delayRate
                }
                activePolicies={options.activePolicies ?? []}
                onEvidence={options.onEvidence}
              />
              <LocationProbe />
            </>
          }
        />
        <Route path="/policies" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InsureBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({});
    refreshPoliciesMock.mockResolvedValue(undefined);
    refreshMeMock.mockResolvedValue(undefined);
    useEventStore.setState({
      flares: [],
      toasts: [],
      events: [],
      wsState: "idle",
    });
  });

  it("shows a success toast and navigates back to location.state.from after BUY", async () => {
    renderInsureBlock({ from: "/policies" });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/policies$/),
    );
    expect(useEventStore.getState().toasts[0]).toMatchObject({
      message: "✓ Insured · BA178 · 10 RIA",
    });
  });

  it("navigates to tower when no source route is available", async () => {
    renderInsureBlock(null);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/),
    );
  });

  it("shows quote explanation with premium tier, multiplier, delay rate, coverage, and settlement guidance", () => {
    renderInsureBlock({ from: "/policies" });

    expect(screen.getByText("PREMIUM TIER")).toBeInTheDocument();
    expect(screen.getAllByText("10 RIA").length).toBeGreaterThan(0);
    expect(screen.getByText("ESTIMATED PAYOUT")).toBeInTheDocument();
    expect(screen.getByText("≈ 49 RIA")).toBeInTheDocument();
    expect(screen.getByText("MULTIPLIER")).toBeInTheDocument();
    expect(screen.getByText("4.9×")).toBeInTheDocument();
    expect(screen.getByText("HISTORICAL DELAY RATE")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("COVERAGE")).toBeInTheDocument();
    expect(screen.getByText("Delayed ≥ 30 min")).toBeInTheDocument();
    expect(screen.getByText("SETTLEMENT")).toBeInTheDocument();
    expect(
      screen.getByText(/Rialo reactive contract watches flight data and settles automatically\./i),
    ).toBeInTheDocument();
  });

  it("updates estimated payout when premium changes while keeping quote context consistent", () => {
    renderInsureBlock({ from: "/policies" });

    fireEvent.click(screen.getByRole("button", { name: "5 RIA" }));
    expect(screen.getByText("≈ 24 RIA")).toBeInTheDocument();
    expect(screen.getByText("4.9×")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Delayed ≥ 30 min")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "20 RIA" }));
    expect(screen.getByText("≈ 97 RIA")).toBeInTheDocument();
    expect(screen.getByText("4.9×")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("Delayed ≥ 30 min")).toBeInTheDocument();
  });

  it("shows a safe degraded quote when flight pricing data is unavailable", () => {
    renderInsureBlock({ from: "/policies" }, { delayRate: null });

    expect(screen.getByText("Signal unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Flight signal unavailable. Quote paused until tracking resumes."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /flight signal unavailable/i })).toBeDisabled();
  });
});
