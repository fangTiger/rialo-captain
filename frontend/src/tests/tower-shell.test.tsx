import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { TowerShell } from "../routes/TowerShell";

const cinemaState = vi.hoisted(() => ({
  interrupt: vi.fn(),
  cameraTarget: null as { reason: string } | null,
  kpiTickId: 7,
  mode: "cinema" as const,
  phase: "story" as const,
  protagonist: {
    kind: "DEMO" as const,
    flightId: "BA178",
    callsign: "BA178",
    longitude: -73.78,
    latitude: 40.64,
    name: "Alice",
  },
}));

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: [
      {
        icao24: "a1b2c3",
        callsign: "BA178",
        origin_country: "United Kingdom",
        longitude: -73.78,
        latitude: 40.64,
        velocity: 240,
        heading: 90,
        on_ground: false,
      },
    ],
    stale: false,
    staleSeconds: 0,
    error: undefined,
    isLoading: false,
  }),
}));

vi.mock("../components/cinema/CinemaContext", async () => {
  const actual = await vi.importActual<
    typeof import("../components/cinema/CinemaContext")
  >("../components/cinema/CinemaContext");
  return {
    ...actual,
    CinemaProvider: ({
      children,
      initialProtagonist,
    }: {
      children: React.ReactNode;
      initialProtagonist?: { callsign: string } | null;
    }) => (
      <div
        data-testid="cinema-provider"
        data-protagonist={initialProtagonist?.callsign ?? "none"}
      >
        {children}
      </div>
    ),
    useCinema: () => cinemaState,
  };
});

vi.mock("../components/cinema/CinemaController", () => ({
  CinemaController: () => <div data-testid="cinema-controller" />,
}));

vi.mock("../components/cinema/AutoSeeder", () => ({
  AutoSeeder: ({ flights }: { flights: unknown[] }) => (
    <div data-testid="auto-seeder" data-flights={flights.length} />
  ),
}));

vi.mock("../components/cinema/EventChoreographer", () => ({
  EventChoreographer: () => <div data-testid="event-choreographer" />,
}));

vi.mock("../components/cinema/CameraDirector", () => ({
  CameraDirector: ({
    children,
  }: {
    children: (cameraTarget: unknown) => React.ReactNode;
  }) => (
    <div data-testid="camera-director">
      {children(cinemaState.cameraTarget)}
    </div>
  ),
}));

vi.mock("../components/cinema/CinemaOverlay", () => ({
  CinemaOverlay: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="cinema-overlay">{children}</div>
  ),
}));

vi.mock("../components/cinema/ModeIndicator", () => ({
  ModeIndicator: () => <div data-testid="mode-indicator">CINEMA</div>,
}));

vi.mock("../components/cinema/ProtagonistBadge", () => ({
  ProtagonistBadge: () => <div data-testid="protagonist-badge">DEMO</div>,
}));

vi.mock("../components/cinema/HeatmapBg", () => ({
  HeatmapBg: ({
    points,
    viewport,
  }: {
    points: unknown[];
    viewport: { k: number; x: number; y: number };
  }) => (
    <div
      data-testid="heatmap-bg"
      data-points={points.length}
      data-viewport={`${viewport.k}:${viewport.x}:${viewport.y}`}
      style={{ pointerEvents: "none" }}
    />
  ),
}));

vi.mock("../components/cinema/TrailDraw", () => ({
  TrailDraw: ({ points }: { points: unknown[] }) => (
    <div data-testid="trail-draw" data-points={points.length} />
  ),
}));

vi.mock("../components/tower/GlobeMap", () => ({
  GlobeMap: ({
    cameraTarget,
    onViewportChange,
    onUserGesture,
    onSelectFlight,
    protagonistHighlight,
  }: {
    cameraTarget?: { reason: string } | null;
    onViewportChange?: (viewport: { k: number; x: number; y: number }) => void;
    onUserGesture?: () => void;
    onSelectFlight?: (callsign: string) => void;
    protagonistHighlight?: { callsign: string } | null;
  }) => (
    <div>
      <button
        type="button"
        data-testid="mock-globe"
        data-camera-reason={cameraTarget?.reason ?? "none"}
        data-protagonist-highlight={protagonistHighlight?.callsign ?? "none"}
        data-has-on-viewport-change={String(Boolean(onViewportChange))}
        onClick={() => onSelectFlight?.("BA178")}
      >
        mock globe
      </button>
      <button
        type="button"
        data-testid="mock-viewport-change"
        onClick={() => onViewportChange?.({ k: 1.4, x: 12, y: -8 })}
      >
        mock viewport change
      </button>
      <button type="button" onClick={() => onUserGesture?.()}>
        mock user gesture
      </button>
    </div>
  ),
}));

vi.mock("../components/tower/RadarSweep", () => ({
  RadarSweep: ({
    atRisk,
    protagonistCallsign,
  }: {
    atRisk?: boolean;
    protagonistCallsign?: string;
  }) => (
    <div
      data-testid="radar-sweep"
      data-at-risk={String(Boolean(atRisk))}
      data-protagonist={protagonistCallsign ?? "none"}
    >
      radar sweep
    </div>
  ),
}));

vi.mock("../components/tower/EventFeedSidebar", () => ({
  EventFeedSidebar: () => <div>event feed</div>,
}));

vi.mock("../components/tower/KPIBand", () => ({
  KPIBand: ({ tickId }: { tickId?: number }) => (
    <div data-testid="kpi-band" data-tick-id={tickId ?? 0}>
      kpi band
    </div>
  ),
}));

vi.mock("../components/tower/DataStaleBadge", () => ({
  DataStaleBadge: () => <div>data stale</div>,
}));

function FlightDetailProbe() {
  const { id } = useParams();
  return <div>flight detail {id}</div>;
}

describe("TowerShell", () => {
  afterEach(() => {
    vi.useRealTimers();
    cinemaState.interrupt.mockReset();
  });

  it("composes the live tower layers and navigates when a flight is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
          <Route path="/flight/:id" element={<FlightDetailProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("cinema-provider")).toHaveAttribute(
      "data-protagonist",
      "BA178",
    );
    expect(screen.getByTestId("cinema-controller")).toBeInTheDocument();
    expect(screen.getByTestId("auto-seeder")).toHaveAttribute(
      "data-flights",
      "1",
    );
    expect(screen.getByTestId("event-choreographer")).toBeInTheDocument();
    expect(screen.getByTestId("camera-director")).toBeInTheDocument();
    expect(screen.getByTestId("cinema-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("protagonist-badge"),
    );
    expect(screen.getByTestId("map-atmosphere-layer")).toContainElement(
      screen.getByTestId("heatmap-bg"),
    );
    expect(screen.getByTestId("map-atmosphere-layer")).toHaveStyle({
      pointerEvents: "none",
    });
    expect(screen.getByTestId("traildraw-layer")).toBeInTheDocument();
    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("traildraw-layer"),
    );
    expect(screen.getByTestId("mode-indicator")).toHaveTextContent("CINEMA");
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("DEMO");
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-camera-reason",
      "none",
    );
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "BA178",
    );
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-has-on-viewport-change",
      "true",
    );
    expect(screen.getByTestId("radar-sweep")).toHaveAttribute(
      "data-at-risk",
      "true",
    );
    expect(screen.getByTestId("radar-sweep")).toHaveAttribute(
      "data-protagonist",
      "BA178",
    );
    expect(screen.getByTestId("kpi-band")).toHaveAttribute(
      "data-tick-id",
      "7",
    );
    expect(screen.getByText("mock globe")).toBeInTheDocument();
    expect(screen.getByText("radar sweep")).toBeInTheDocument();
    expect(screen.getByText("event feed")).toBeInTheDocument();
    expect(screen.getByText("kpi band")).toBeInTheDocument();
    expect(screen.getByText("data stale")).toBeInTheDocument();

    fireEvent.click(screen.getByText("mock globe"));

    expect(screen.getByText("flight detail BA178-20260614")).toBeInTheDocument();
  });

  it("keeps user gesture wiring for manual takeover", () => {
    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("map-atmosphere-layer")).toHaveStyle({
      pointerEvents: "none",
    });
    expect(screen.getByTestId("traildraw-layer")).toHaveStyle({
      pointerEvents: "none",
    });
    expect(screen.getByTestId("key-moment-layer")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByText("mock user gesture"));

    expect(cinemaState.interrupt).toHaveBeenCalledTimes(1);
  });
});
