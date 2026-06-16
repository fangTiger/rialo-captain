import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TRAIL_DRAW_TTL_MS,
  useTrailDraw,
} from "../components/cinema/useTrailDraw";
import type {
  CinemaMode,
  CinemaPhase,
  CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import type { FlightPublic } from "../hooks/useFlights";

const cycleStartedAt = new Date("2026-06-15T00:00:00.000Z").getTime();

const protagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178-20260615",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
};

const flights: FlightPublic[] = [
  {
    icao24: "abc123",
    callsign: "BA178",
    origin_country: "United Kingdom",
    longitude: -73.78,
    latitude: 40.64,
    velocity: 240,
    heading: 90,
    on_ground: false,
  },
];

interface TrailProbeProps {
  mode?: CinemaMode;
  phase?: CinemaPhase;
  activeProtagonist?: CinemaProtagonist | null;
  liveFlights?: FlightPublic[];
  userElectedFlight?: FlightPublic | null;
  resetToken?: number;
  ttlMs?: number;
}

function TrailProbe({
  mode = "cinema",
  phase = "story",
  activeProtagonist = protagonist,
  liveFlights = flights,
  userElectedFlight = null,
  resetToken = 0,
  ttlMs = TRAIL_DRAW_TTL_MS,
}: TrailProbeProps) {
  const { activeTrail } = useTrailDraw({
    mode,
    phase,
    cycleStartedAt,
    protagonist: activeProtagonist,
    flights: liveFlights,
    userElectedFlight,
    resetToken,
    ttlMs,
  });
  const lastPoint = activeTrail?.points.at(-1);

  return (
    <div data-testid="trail-state">
      {activeTrail
        ? [
            activeTrail.id,
            activeTrail.startedAt,
            activeTrail.points.length,
            lastPoint
              ? `last:${lastPoint.longitude.toFixed(3)},${lastPoint.latitude.toFixed(3)}`
              : "last:none",
          ].join("|")
        : "none"}
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useTrailDraw", () => {
  it("triggers once when the cycle reaches the 3 second trail gate", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    render(<TrailProbe phase="establish" />);

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId("trail-state")).toHaveTextContent(
      `${cycleStartedAt}:BA178-20260615:traildraw`,
    );
    expect(screen.getByTestId("trail-state")).toHaveTextContent("|4");
  });

  it("does not retrigger for the same cycle and protagonist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 3_000);

    const { rerender } = render(<TrailProbe phase="establish" />);
    const firstState = screen.getByTestId("trail-state").textContent;

    vi.setSystemTime(cycleStartedAt + 4_000);
    rerender(
      <TrailProbe
        phase="establish"
        activeProtagonist={{
          ...protagonist,
        }}
      />,
    );

    expect(screen.getByTestId("trail-state").textContent).toBe(firstState);
  });

  it("anchors the trail endpoint to the matched live flight position instead of a stale protagonist snapshot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    render(
      <TrailProbe
        phase="establish"
        activeProtagonist={{
          ...protagonist,
          callsign: "BA178-20260615",
          flightId: "BA178-20260615",
          longitude: -73.78,
          latitude: 40.64,
        }}
        liveFlights={[
          {
            ...flights[0],
            callsign: "BA178",
            longitude: -72,
            latitude: 41,
            heading: 90,
            velocity: 240,
          },
        ]}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    const text = screen.getByTestId("trail-state").textContent ?? "";
    const match = text.match(/last:(-?\d+\.\d+),(-?\d+\.\d+)/);
    expect(match).not.toBeNull();
    if (!match) throw new Error(`missing trail endpoint in ${text}`);

    const longitude = Number(match[1]);
    const latitude = Number(match[2]);
    expect(longitude).toBeGreaterThan(-72);
    expect(latitude).toBeCloseTo(41, 3);
  });

  it("draws the user-elected flight trail even after cinema is interrupted", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);
    const electedFlight: FlightPublic = {
      ...flights[0],
      callsign: "DL101",
      longitude: -72,
      latitude: 41,
      heading: 90,
      velocity: 240,
    };
    const liveFlights = [electedFlight];

    const { rerender } = render(
      <TrailProbe
        mode="interactive"
        phase="establish"
        activeProtagonist={null}
        liveFlights={liveFlights}
      />,
    );
    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");

    vi.setSystemTime(cycleStartedAt + 1_000);
    rerender(
      <TrailProbe
        mode="interactive"
        phase="establish"
        activeProtagonist={null}
        liveFlights={liveFlights}
        userElectedFlight={electedFlight}
      />,
    );

    const text = screen.getByTestId("trail-state").textContent ?? "";
    expect(text).toMatch(/^elected:DL101:\d+:traildraw\|/);
    const match = text.match(/last:(-?\d+\.\d+),(-?\d+\.\d+)/);
    expect(match).not.toBeNull();
    if (!match) throw new Error(`missing elected trail endpoint in ${text}`);
    expect(Number(match[1])).toBeGreaterThan(-72);
    expect(Number(match[2])).toBeCloseTo(41, 3);
  });

  it("replaces the active trail when the user elects another flight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);
    const firstFlight = flights[0];
    const secondFlight: FlightPublic = {
      ...flights[0],
      icao24: "def456",
      callsign: "DL101",
      longitude: -118.41,
      latitude: 33.94,
      heading: 80,
      velocity: 230,
    };

    const { rerender } = render(
      <TrailProbe
        mode="interactive"
        activeProtagonist={null}
        liveFlights={[firstFlight, secondFlight]}
        userElectedFlight={firstFlight}
      />,
    );
    const firstState = screen.getByTestId("trail-state").textContent ?? "";
    expect(firstState).toMatch(/^elected:BA178:\d+:traildraw\|/);

    rerender(
      <TrailProbe
        mode="interactive"
        activeProtagonist={null}
        liveFlights={[firstFlight, secondFlight]}
        userElectedFlight={secondFlight}
      />,
    );

    const secondState = screen.getByTestId("trail-state").textContent ?? "";
    expect(secondState).toMatch(/^elected:DL101:\d+:traildraw\|/);
    expect(secondState).not.toBe(firstState);
  });

  it.each<CinemaMode>(["interactive", "paused-hidden", "degraded"])(
    "does not trigger while mode is %s",
    (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(cycleStartedAt + 3_000);

      render(<TrailProbe mode={mode} phase="establish" />);

      expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
    },
  );

  it("does not trigger without a protagonist or with invalid coordinates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 3_000);

    const { rerender } = render(
      <TrailProbe phase="establish" activeProtagonist={null} />,
    );

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");

    rerender(
      <TrailProbe
        phase="establish"
        activeProtagonist={{
          ...protagonist,
          longitude: Number.NaN,
        }}
      />,
    );

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
  });

  it("clears the active trail after ttl", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 3_000);

    render(<TrailProbe phase="establish" ttlMs={3_000} />);

    expect(screen.getByTestId("trail-state")).not.toHaveTextContent("none");

    act(() => {
      vi.advanceTimersByTime(2_999);
    });
    expect(screen.getByTestId("trail-state")).not.toHaveTextContent("none");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
  });

  it("clears the active trail when the cinema reset token changes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 3_000);

    const { rerender } = render(<TrailProbe phase="establish" resetToken={0} />);

    expect(screen.getByTestId("trail-state")).not.toHaveTextContent("none");

    rerender(<TrailProbe phase="establish" resetToken={1} />);

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
  });

  it("removes the pending ttl timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 3_000);

    const { unmount } = render(<TrailProbe phase="establish" ttlMs={3_000} />);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
