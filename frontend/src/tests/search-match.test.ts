import { describe, expect, it } from "vitest";
import type { FlightPublic } from "../hooks/useFlights";
import { matches } from "../components/search/searchMatch";

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

describe("matches", () => {
  it("matches callsign substrings", () => {
    expect(matches(flight(), "UAL")).toBe(true);
  });

  it("matches origin airport code", () => {
    expect(matches(flight(), "SFO")).toBe(true);
  });

  it("matches destination airport code", () => {
    expect(matches(flight(), "JFK")).toBe(true);
  });

  it("matches origin to destination with ASCII arrow", () => {
    expect(matches(flight(), "SFO->JFK")).toBe(true);
  });

  it("matches origin to destination with single character arrow", () => {
    expect(matches(flight(), "SFO→JFK")).toBe(true);
  });

  it("matches without case sensitivity", () => {
    expect(matches(flight(), "ual")).toBe(true);
    expect(matches(flight(), "sfo->jfk")).toBe(true);
  });

  it("returns false for blank query", () => {
    expect(matches(flight(), "   ")).toBe(false);
  });

  it("still matches callsign when origin and destination are null", () => {
    expect(
      matches(flight({ callsign: "OPS001", origin: null, destination: null }), "OPS"),
    ).toBe(true);
  });
});
