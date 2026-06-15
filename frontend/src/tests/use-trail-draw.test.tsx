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
  resetToken?: number;
  ttlMs?: number;
}

function TrailProbe({
  mode = "cinema",
  phase = "story",
  activeProtagonist = protagonist,
  liveFlights = flights,
  resetToken = 0,
  ttlMs = TRAIL_DRAW_TTL_MS,
}: TrailProbeProps) {
  const { activeTrail } = useTrailDraw({
    mode,
    phase,
    cycleStartedAt,
    protagonist: activeProtagonist,
    flights: liveFlights,
    resetToken,
    ttlMs,
  });

  return (
    <div data-testid="trail-state">
      {activeTrail
        ? `${activeTrail.id}|${activeTrail.startedAt}|${activeTrail.points.length}`
        : "none"}
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useTrailDraw", () => {
  it("triggers once when the cinema phase enters story", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 7_000);

    const { rerender } = render(<TrailProbe phase="zoom-in" />);

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");

    rerender(<TrailProbe phase="story" />);

    expect(screen.getByTestId("trail-state")).toHaveTextContent(
      `${cycleStartedAt}:BA178-20260615:traildraw`,
    );
    expect(screen.getByTestId("trail-state")).toHaveTextContent("|4");
  });

  it("does not retrigger for the same cycle and protagonist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 7_000);

    const { rerender } = render(<TrailProbe phase="story" />);
    const firstState = screen.getByTestId("trail-state").textContent;

    vi.setSystemTime(cycleStartedAt + 8_000);
    rerender(
      <TrailProbe
        phase="story"
        activeProtagonist={{
          ...protagonist,
        }}
      />,
    );

    expect(screen.getByTestId("trail-state").textContent).toBe(firstState);
  });

  it.each<CinemaMode>(["interactive", "paused-hidden", "degraded"])(
    "does not trigger while mode is %s",
    (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(cycleStartedAt + 7_000);

      render(<TrailProbe mode={mode} phase="story" />);

      expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
    },
  );

  it("does not trigger without a protagonist or with invalid coordinates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 7_000);

    const { rerender } = render(
      <TrailProbe phase="story" activeProtagonist={null} />,
    );

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");

    rerender(
      <TrailProbe
        phase="story"
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
    vi.setSystemTime(cycleStartedAt + 7_000);

    render(<TrailProbe phase="story" ttlMs={3_000} />);

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
    vi.setSystemTime(cycleStartedAt + 7_000);

    const { rerender } = render(<TrailProbe phase="story" resetToken={0} />);

    expect(screen.getByTestId("trail-state")).not.toHaveTextContent("none");

    rerender(<TrailProbe phase="story" resetToken={1} />);

    expect(screen.getByTestId("trail-state")).toHaveTextContent("none");
  });

  it("removes the pending ttl timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt + 7_000);

    const { unmount } = render(<TrailProbe phase="story" ttlMs={3_000} />);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
