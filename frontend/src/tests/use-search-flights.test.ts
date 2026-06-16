import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlightPublic } from "../hooks/useFlights";
import { useSearchFlights } from "../hooks/useSearchFlights";

const flightsState = vi.hoisted(() => ({
  flights: [] as FlightPublic[],
  isLoading: false,
}));

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: flightsState.flights,
    isLoading: flightsState.isLoading,
  }),
}));

function flight(overrides: Partial<FlightPublic> = {}): FlightPublic {
  return {
    icao24: "abc123",
    callsign: "UAL2351",
    origin_country: "United States",
    longitude: -122.38,
    latitude: 37.62,
    velocity: 240,
    heading: 90,
    on_ground: false,
    origin: "SFO",
    destination: "JFK",
    ...overrides,
  };
}

describe("useSearchFlights", () => {
  beforeEach(() => {
    vi.useRealTimers();
    flightsState.flights = [];
    flightsState.isLoading = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty results and zero total for blank query", () => {
    flightsState.flights = [flight()];

    const { result } = renderHook(() => useSearchFlights("   "));

    expect(result.current.results).toEqual([]);
    expect(result.current.totalMatches).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("sorts matching results by callsign", () => {
    flightsState.flights = [
      flight({ callsign: "UAL3000", destination: "JFK" }),
      flight({ callsign: "AAL1000", destination: "JFK" }),
      flight({ callsign: "DAL2000", destination: "JFK" }),
    ];

    const { result } = renderHook(() => useSearchFlights("JFK"));

    expect(result.current.results.map((item) => item.callsign)).toEqual([
      "AAL1000",
      "DAL2000",
      "UAL3000",
    ]);
  });

  it("limits displayed results to ten while preserving total matches", () => {
    flightsState.flights = Array.from({ length: 12 }, (_, index) =>
      flight({
        callsign: `UAL${String(index).padStart(4, "0")}`,
        origin: "SFO",
        destination: "JFK",
      }),
    );

    const { result } = renderHook(() => useSearchFlights("UAL"));

    expect(result.current.results).toHaveLength(10);
    expect(result.current.totalMatches).toBe(12);
  });

  it("adds a today flight id fallback to each result", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-16T12:00:00Z"));
    flightsState.flights = [flight({ callsign: "UAL2351" })];

    const { result } = renderHook(() => useSearchFlights("UAL"));

    expect(result.current.results[0].flight_id).toBe("UAL2351-20260616");
    expect(result.current.results[0].id).toBe("UAL2351-20260616");
  });
});
