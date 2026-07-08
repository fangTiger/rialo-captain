import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobeMap } from "../components/tower/GlobeMap";
import { usePoolStore } from "../store/pool";
import type { FlightPublic } from "../hooks/useFlights";

const flight: FlightPublic = {
  icao24: "a1b2c3",
  callsign: "BA178",
  origin_country: "United Kingdom",
  longitude: -73.78,
  latitude: 40.64,
  velocity: 240,
  heading: 90,
  on_ground: false,
  underwritten_by_pool_id: "pool-1",
};

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: [flight],
    stale: false,
    staleSeconds: 0,
    error: undefined,
    isLoading: false,
  }),
}));

class MockResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe() {
    this.callback(
      [{ contentRect: { width: 1200, height: 720 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  }
  disconnect() {}
  unobserve() {}
}

const activePool = {
  id: "pool-1",
  user_id: "user-1",
  preset_style: "steady" as const,
  status: "active" as const,
  stake_ria: 200,
  balance: 200,
  pl: 0,
  rule: {
    delay_threshold_min: 30,
    payout_multiplier: 3,
    include_hubs: true,
    exclude_thunderstorm: true,
    cover_red_eye: false,
  },
  created_at: "2026-07-08T00:00:00Z",
  closed_at: null,
};

describe("GlobeMap underwriter overlays", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    usePoolStore.getState().resetPoolState();
    usePoolStore.getState().setActivePool(activePool);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("marks my underwritten flight dot while preserving the protagonist ring", () => {
    render(
      <GlobeMap
        protagonistHighlight={{
          callsign: "BA178",
          flightId: "BA178-20260708",
        }}
      />,
    );

    expect(screen.getByTestId("flight-dot-BA178")).toHaveClass("flight-dot--mine");
    expect(screen.getByTestId("protagonist-ring-BA178")).toBeInTheDocument();
  });

  it("shows and clears a green claim-paid flare for my pool", () => {
    render(<GlobeMap />);

    act(() => {
      usePoolStore.getState().applyPoolEvent("pool.claim_paid", {
        pool_id: "pool-1",
        policy_id: "policy-1",
        flight_id: "BA178-20260708",
        callsign: "BA178",
        payout: 80,
        balance_after: 120,
        pl: -80,
      });
    });

    expect(screen.getByTestId("underwriter-flare-BA178")).toHaveClass(
      "underwriter-flare",
    );

    act(() => {
      vi.advanceTimersByTime(1_450);
    });

    expect(screen.queryByTestId("underwriter-flare-BA178")).not.toBeInTheDocument();
  });
});
