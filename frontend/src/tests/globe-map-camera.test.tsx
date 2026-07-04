import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cameraTargetToViewport,
  projectLonLat,
} from "../components/cinema/cameraMath";
import type {
  CameraTarget,
  CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import { GlobeMap } from "../components/tower/GlobeMap";
import type { TowerRiskSignal } from "../components/tower/riskSignals";
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
};

const target: CameraTarget = {
  longitude: -73.78,
  latitude: 40.64,
  zoom: 5,
  durationMs: 1_000,
  reason: "protagonist",
};

const protagonistHighlight: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178-20260615",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

const riskSignal: TowerRiskSignal = {
  metadata: {
    source: "simulated",
    sourceLabel: "Simulated signal",
    modelVersion: "Rialo demo risk v2",
    forecastWindowMinutes: 15,
    forecastWindowStartedAt: "2026-07-03T07:00:00.000Z",
    confidence: 0.72,
    confidenceLabel: "Medium confidence",
  },
  weatherCells: [
    {
      id: "cell-low",
      longitude: -150,
      latitude: 42,
      radiusDeg: 8.2,
      level: "low",
      drift: "ne",
    },
    {
      id: "cell-elevated",
      longitude: -106,
      latitude: 36,
      radiusDeg: 7.8,
      level: "elevated",
      drift: "sw",
    },
    {
      id: "cell-severe",
      longitude: -58,
      latitude: 26,
      radiusDeg: 6.5,
      level: "severe",
      drift: "nw",
    },
    {
      id: "cell-low-europe",
      longitude: 6,
      latitude: 50,
      radiusDeg: 7.1,
      level: "low",
      drift: "se",
    },
    {
      id: "cell-elevated-africa",
      longitude: 18,
      latitude: 4,
      radiusDeg: 9.4,
      level: "elevated",
      drift: "ne",
    },
    {
      id: "cell-severe-asia",
      longitude: 78,
      latitude: 22,
      radiusDeg: 8.8,
      level: "severe",
      drift: "sw",
    },
    {
      id: "cell-elevated-pacific",
      longitude: 137,
      latitude: 34,
      radiusDeg: 7.4,
      level: "elevated",
      drift: "nw",
    },
    {
      id: "cell-low-australia",
      longitude: 146,
      latitude: -29,
      radiusDeg: 8.1,
      level: "low",
      drift: "se",
    },
    {
      id: "cell-elevated-south-atlantic",
      longitude: -24,
      latitude: -28,
      radiusDeg: 7.9,
      level: "elevated",
      drift: "ne",
    },
    {
      id: "cell-low-indian",
      longitude: 62,
      latitude: -12,
      radiusDeg: 8.6,
      level: "low",
      drift: "sw",
    },
  ],
  weatherBands: [
    {
      id: "band-north-atlantic-front",
      points: [
        [-145, 48],
        [-84, 41],
        [-28, 49],
        [34, 45],
      ],
      widthDeg: 8.5,
      level: "elevated",
      drift: "ne",
      kind: "front",
    },
    {
      id: "band-equatorial-rain",
      points: [
        [-92, 9],
        [-24, 5],
        [46, 8],
        [118, 12],
      ],
      widthDeg: 10,
      level: "low",
      drift: "se",
      kind: "rain",
    },
    {
      id: "band-asia-pacific-severe",
      points: [
        [68, 24],
        [101, 18],
        [148, 30],
      ],
      widthDeg: 9.2,
      level: "severe",
      drift: "sw",
      kind: "wind",
    },
  ],
  corridor: {
    callsign: "BA178",
    from: [-78.2, 39.7],
    to: [-69.4, 41.3],
    pressureLevel: "severe",
    riskDeltaPct: 28.4,
    segments: [
      {
        id: "BA178-corridor-low",
        from: [-78.2, 39.7],
        to: [-75.27, 40.23],
        level: "low",
      },
      {
        id: "BA178-corridor-elevated",
        from: [-75.27, 40.23],
        to: [-72.33, 40.77],
        level: "elevated",
      },
      {
        id: "BA178-corridor-severe",
        from: [-72.33, 40.77],
        to: [-69.4, 41.3],
        level: "severe",
      },
    ],
  },
  market: {
    subjectLabel: "BA178",
    marketProbability: 0.38,
    modelProbability: 0.31,
    marketOdds: 2.6,
    spread: 0.07,
    spreadLabel: "Market more bearish",
    divergence: {
      valuePp: 7,
      direction: "market",
      label: "Market more bearish",
      tone: "elevated",
    },
    insight: "BA178 trades richer than the Rialo model.",
  },
  weatherContribution: {
    subjectLabel: "BA178",
    pressureLevel: "severe",
    contributionPp: 10,
    riskDeltaPct: 28.4,
    explanation:
      "BA178 severe weather pressure adds +10.0pp corridor model risk; signal-only context.",
  },
  watchlist: [
    {
      id: "BA178-0",
      callsign: "BA178",
      probability: 0.38,
      odds: 2.6,
      direction: "up",
      pressureLevel: "severe",
      pressureLabel: "Severe pressure",
    },
  ],
};

const size = { width: 1200, height: 720 };
const safeAreaInsets = {
  left: 500,
  right: 380,
  top: 260,
  bottom: 96,
};

let rafId = 0;
let rafCallbacks: Map<number, FrameRequestCallback>;
let resizeObserverCallback: ResizeObserverCallback | null = null;

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
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback;
  }

  observe() {}

  disconnect() {}
  unobserve() {}
}

function emitResize(nextSize: typeof size) {
  const callback = resizeObserverCallback;
  if (!callback) throw new Error("ResizeObserver was not initialized");

  act(() => {
    callback(
      [{ contentRect: nextSize } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
  });
}

function runNextFrame(timestamp: number) {
  const [id, callback] = Array.from(rafCallbacks.entries())[0];
  rafCallbacks.delete(id);
  act(() => {
    callback(timestamp);
  });
}

function runAnimationFrames(stepMs: number, frameCount: number) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (rafCallbacks.size === 0) break;
    runNextFrame(frame * stepMs);
  }
}

describe("GlobeMap spotlight and legacy camera target", () => {
  beforeEach(() => {
    rafId = 0;
    rafCallbacks = new Map();
    resizeObserverCallback = null;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        rafId += 1;
        rafCallbacks.set(rafId, callback);
        return rafId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        rafCallbacks.delete(id);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a more visible radar frame around the map edge", () => {
    render(<GlobeMap />);

    expect(screen.getByTestId("globe-map-frame")).toHaveStyle({
      border: "1px solid rgba(0, 255, 157, 0.28)",
      outline: "1px solid rgba(255, 255, 255, 0.08)",
    });
    expect(screen.getByTestId("globe-map-frame").style.boxShadow).toContain(
      "inset 0 0 0 1px rgba(255, 255, 255, 0.05)",
    );
  });

  it("applies cameraTarget to the existing viewport transform through RAF", () => {
    render(<GlobeMap cameraTarget={target} />);

    runNextFrame(0);
    runNextFrame(1_000);

    const expected = cameraTargetToViewport(target, size);
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${expected.x},${expected.y}) scale(${expected.k})`,
    );
  });

  it("uses the measured mobile container width without forcing a desktop map width", async () => {
    const mobileSize = { width: 390, height: 520 };
    const onViewportChange = vi.fn();

    render(<GlobeMap onViewportChange={onViewportChange} />);
    emitResize(mobileSize);

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /global flight radar/i })).toHaveAttribute(
        "width",
        "390",
      );
    });
    expect(screen.getByRole("img", { name: /global flight radar/i })).toHaveAttribute(
      "height",
      "520",
    );
    expect(onViewportChange).toHaveBeenLastCalledWith(
      { k: 1, x: 0, y: 0 },
      mobileSize,
    );
  });

  it("lands safe-area camera targets on the unobstructed viewport anchor", () => {
    const safeAreaTarget = {
      ...target,
      safeAreaInsets,
    } as CameraTarget & { safeAreaInsets: typeof safeAreaInsets };

    render(<GlobeMap cameraTarget={safeAreaTarget} />);

    runNextFrame(0);
    runNextFrame(1_000);

    const point = projectLonLat(
      safeAreaTarget.longitude,
      safeAreaTarget.latitude,
      size,
    );
    const anchorX =
      safeAreaInsets.left +
      (size.width - safeAreaInsets.left - safeAreaInsets.right) / 2;
    const anchorY =
      safeAreaInsets.top +
      (size.height - safeAreaInsets.top - safeAreaInsets.bottom) / 2;

    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${anchorX - point.x * safeAreaTarget.zoom},${anchorY - point.y * safeAreaTarget.zoom}) scale(${safeAreaTarget.zoom})`,
    );
  });

  it("throttles long camera animations while still landing on the target viewport", () => {
    const onViewportChange = vi.fn();
    const longTarget: CameraTarget = {
      ...target,
      durationMs: 2_000,
    };

    render(
      <GlobeMap
        cameraTarget={longTarget}
        onViewportChange={onViewportChange}
      />,
    );

    runAnimationFrames(16, 130);

    const expected = cameraTargetToViewport(longTarget, size);
    expect(onViewportChange.mock.calls.length).toBeLessThanOrEqual(50);
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${expected.x},${expected.y}) scale(${expected.k})`,
    );
  });

  it("exposes an e2e-stable protagonist selector without changing the global viewport", () => {
    render(<GlobeMap protagonistHighlight={protagonistHighlight} />);

    expect(screen.getByTestId("flight-dot-BA178")).toHaveAttribute(
      "data-protagonist",
      "true",
    );
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      "translate(0,0) scale(1)",
    );
  });

  it("cancels camera animation on user gestures while preserving flight click", () => {
    const onUserGesture = vi.fn();
    const onSelectFlight = vi.fn();
    render(
      <GlobeMap
        cameraTarget={target}
        onUserGesture={onUserGesture}
        onSelectFlight={onSelectFlight}
      />,
    );

    expect(rafCallbacks.size).toBe(1);

    fireEvent.wheel(screen.getByRole("img", { name: /global flight radar/i }), {
      deltaY: -1,
      clientX: 600,
      clientY: 360,
    });

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);

    fireEvent.mouseDown(screen.getByRole("img", { name: /global flight radar/i }), {
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.mouseMove(screen.getByRole("img", { name: /global flight radar/i }), {
      buttons: 1,
      clientX: 430,
      clientY: 320,
    });
    fireEvent.mouseUp(screen.getByRole("img", { name: /global flight radar/i }));

    expect(onUserGesture).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId("flight-dot-BA178"));

    expect(onUserGesture).toHaveBeenCalledTimes(3);
    expect(onSelectFlight).toHaveBeenCalledWith("BA178");
  });

  it("keeps protagonist highlight passive while the flight dot and map gestures stay interactive", () => {
    const onUserGesture = vi.fn();
    const onSelectFlight = vi.fn();
    render(
      <GlobeMap
        protagonistHighlight={protagonistHighlight}
        onUserGesture={onUserGesture}
        onSelectFlight={onSelectFlight}
      />,
    );

    expect(screen.getByTestId("protagonist-ring-BA178")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(screen.getByTestId("protagonist-ring-BA178")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByTestId("flight-dot-BA178"));

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(onSelectFlight).toHaveBeenCalledWith("BA178");

    fireEvent.wheel(screen.getByRole("img", { name: /global flight radar/i }), {
      deltaY: -1,
      clientX: 600,
      clientY: 360,
    });

    fireEvent.mouseDown(screen.getByRole("img", { name: /global flight radar/i }), {
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.mouseMove(screen.getByRole("img", { name: /global flight radar/i }), {
      buttons: 1,
      clientX: 430,
      clientY: 320,
    });

    expect(onUserGesture).toHaveBeenCalledTimes(3);
  });

  it("renders the passive weather risk layer with global pressure cells, forecast bands, and corridor", () => {
    render(<GlobeMap weatherLayerVisible riskSignal={riskSignal} />);

    expect(screen.getByTestId("weather-risk-layer")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    const weatherCells = screen.getAllByTestId(/weather-cell-/);
    expect(weatherCells).toHaveLength(riskSignal.weatherCells.length);
    expect(screen.getAllByTestId(/weather-storm-mass-/)).toHaveLength(
      riskSignal.weatherCells.length,
    );
    expect(screen.getAllByTestId("weather-cell-low").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("weather-cell-elevated").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId("weather-cell-severe").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByTestId("weather-severe-cell-pulse").length).toBeGreaterThan(
      0,
    );
    screen.getAllByTestId(/weather-storm-mass-/).forEach((stormMass) => {
      expect(stormMass).toHaveAttribute("pointer-events", "none");
    });
    screen.getAllByTestId("weather-severe-cell-pulse").forEach((pulse) => {
      expect(pulse).toHaveAttribute("pointer-events", "none");
    });
    expect(screen.getAllByTestId(/weather-forecast-band/)).toHaveLength(
      riskSignal.weatherBands.length,
    );
    expect(screen.getByTestId("weather-forecast-band-severe")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    screen.getAllByTestId(/weather-forecast-band/).forEach((band) => {
      expect(band).toHaveAttribute("pointer-events", "none");
    });
    expect(screen.getByTestId("weather-risk-corridor")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(screen.getByTestId("weather-active-corridor")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(screen.getByTestId("weather-corridor-intercept-marker")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(screen.getByTestId("weather-pressure-label")).toHaveTextContent(
      /BA178|SEVERE|\+28\.4pp/i,
    );
    expect(screen.getByTestId("weather-pressure-label")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(
      screen.getByTestId("weather-risk-corridor-segment-low"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("weather-risk-corridor-segment-elevated"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("weather-risk-corridor-segment-severe"),
    ).toBeInTheDocument();
  });

  it("hides weather risk visuals when the weather layer is disabled", () => {
    render(<GlobeMap weatherLayerVisible={false} riskSignal={riskSignal} />);

    expect(screen.queryByTestId("weather-risk-layer")).not.toBeInTheDocument();
  });

  it("keeps weather shapes from blocking flight clicks", () => {
    const onUserGesture = vi.fn();
    const onSelectFlight = vi.fn();
    render(
      <GlobeMap
        weatherLayerVisible
        riskSignal={riskSignal}
        onUserGesture={onUserGesture}
        onSelectFlight={onSelectFlight}
      />,
    );

    expect(screen.getByTestId("weather-risk-layer")).toHaveAttribute(
      "pointer-events",
      "none",
    );

    fireEvent.click(screen.getByTestId("flight-dot-BA178"));

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(onSelectFlight).toHaveBeenCalledWith("BA178");
  });

  it("renders protagonist highlight with CSS pulse animation and without runtime hooks", () => {
    render(<GlobeMap protagonistHighlight={protagonistHighlight} />);

    const ring = screen.getByTestId("protagonist-ring-BA178");
    const spotlightCircles = ring.querySelectorAll("circle");

    expect(spotlightCircles).toHaveLength(2);
    expect(ring).not.toHaveAttribute("data-framer-motion");
    expect(ring).not.toHaveAttribute("data-gsap");
    expect(spotlightCircles[0]).toHaveClass("protagonist-spotlight-ring-animated");
    expect(spotlightCircles[0]).toHaveStyle({
      animationName: "protagonist-spotlight-ring-breathe",
    });
    expect(spotlightCircles[1]).toHaveClass("protagonist-spotlight-pulse-animated");
    expect(spotlightCircles[1]).toHaveStyle({
      animationName: "protagonist-spotlight-pulse-expand",
    });
  });
});
