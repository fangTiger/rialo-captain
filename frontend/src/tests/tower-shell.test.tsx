import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
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

const towerHarness = vi.hoisted(() => ({
  providerMounts: 0,
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
}));

const trailHarness = vi.hoisted(() => ({
  useTrailDraw: vi.fn(() => ({ activeTrail: null })),
}));

interface UseTrailDrawProbeOptions {
  userElectedTrailToken?: number;
}

function lastTrailDrawOptions() {
  const call = trailHarness.useTrailDraw.mock.calls.at(-1) as
    | [UseTrailDrawProbeOptions]
    | undefined;
  return call?.[0];
}

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: towerHarness.flights,
    stale: false,
    staleSeconds: 0,
    error: undefined,
    isLoading: false,
  }),
}));

vi.mock("../components/cinema/useTrailDraw", () => ({
  useTrailDraw: trailHarness.useTrailDraw,
}));

vi.mock("../components/cinema/CinemaContext", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
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
    }) => {
      React.useEffect(() => {
        towerHarness.providerMounts += 1;
      }, []);

      return (
        <div
          data-testid="cinema-provider"
          data-protagonist={initialProtagonist?.callsign ?? "none"}
        >
          {children}
        </div>
      );
    },
    useCinema: () => cinemaState,
  };
});

vi.mock("../components/cinema/CinemaController", () => ({
  CinemaController: () => <div data-testid="cinema-controller" />,
}));

vi.mock("../components/cinema/AutoSeeder", () => ({
  AutoSeeder: ({
    demoSelectionOffset,
    flights,
  }: {
    demoSelectionOffset?: number;
    flights: unknown[];
  }) => (
    <div
      data-testid="auto-seeder"
      data-demo-selection-offset={demoSelectionOffset ?? "none"}
      data-flights={flights.length}
    />
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

vi.mock("../components/drawer/BuyDrawer", () => ({
  BuyDrawer: ({
    flightId,
    onClose,
  }: {
    flightId: string;
    onClose: () => void;
  }) => (
    <div data-testid="buy-drawer" data-flight-id={flightId}>
      buy drawer
      <button type="button" onClick={onClose}>
        close drawer
      </button>
    </div>
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe("TowerShell", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cinemaState.interrupt.mockReset();
    cinemaState.protagonist = {
      kind: "DEMO",
      flightId: "BA178",
      callsign: "BA178",
      longitude: -73.78,
      latitude: 40.64,
      name: "Alice",
    };
    trailHarness.useTrailDraw.mockClear();
    towerHarness.providerMounts = 0;
    towerHarness.flights = [
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
    ];
  });

  it("composes the live tower layers and opens BuyDrawer without leaving the tower", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <LocationProbe />
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

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260614",
    );
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
    expect(
      screen.queryByText("flight detail BA178-20260614"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("close drawer"));

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
  });

  it("passes the selected flight as the user-elected trail protagonist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));

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

    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: null,
      }),
    );

    fireEvent.click(screen.getByText("mock globe"));

    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
          latitude: 40.64,
          longitude: -73.78,
        }),
      }),
    );
  });

  it("keeps the selected flight highlighted and trail-ready after the buy drawer closes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    cinemaState.protagonist = {
      kind: "DEMO",
      flightId: "DL101",
      callsign: "DL101",
      longitude: -118.41,
      latitude: 33.94,
      name: "Bob",
    };
    towerHarness.flights = [
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
      {
        icao24: "d4e5f6",
        callsign: "DL101",
        origin_country: "United States",
        longitude: -118.41,
        latitude: 33.94,
        velocity: 230,
        heading: 80,
        on_ground: false,
      },
    ];

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

    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "DL101",
    );

    fireEvent.click(screen.getByText("mock globe"));

    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "BA178",
    );
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
        }),
        userElectedTrailToken: expect.any(Number),
      }),
    );
    const selectedTrailToken =
      lastTrailDrawOptions()?.userElectedTrailToken ?? 0;

    fireEvent.click(screen.getByText("close drawer"));

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "BA178",
    );
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
        }),
        userElectedTrailToken: expect.any(Number),
      }),
    );
    expect(
      lastTrailDrawOptions()?.userElectedTrailToken ?? 0,
    ).toBeGreaterThan(selectedTrailToken);
  });

  it("uses the session seed to choose a rotating initial demo protagonist", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.000000001);
    towerHarness.flights = [
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
      {
        icao24: "d4e5f6",
        callsign: "DL101",
        origin_country: "United States",
        longitude: -118.41,
        latitude: 33.94,
        velocity: 230,
        heading: 80,
        on_ground: false,
      },
      {
        icao24: "abcdef",
        callsign: "UA200",
        origin_country: "United States",
        longitude: -0.46,
        latitude: 51.47,
        velocity: 220,
        heading: 270,
        on_ground: false,
      },
    ];

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

    expect(screen.getByTestId("cinema-provider")).toHaveAttribute(
      "data-protagonist",
      "DL101",
    );
    expect(screen.getByTestId("auto-seeder")).toHaveAttribute(
      "data-demo-selection-offset",
      "1",
    );
  });

  it("keeps the session seed in memory and avoids provider remounts during live flight updates", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.000000001);
    const storageGetSpy = vi.spyOn(Storage.prototype, "getItem");
    const storageSetSpy = vi.spyOn(Storage.prototype, "setItem");
    const cookieGetSpy = vi.spyOn(Document.prototype, "cookie", "get");
    const cookieSetSpy = vi.spyOn(Document.prototype, "cookie", "set");
    towerHarness.flights = [
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
      {
        icao24: "d4e5f6",
        callsign: "DL101",
        origin_country: "United States",
        longitude: -118.41,
        latitude: 33.94,
        velocity: 230,
        heading: 80,
        on_ground: false,
      },
      {
        icao24: "abcdef",
        callsign: "UA200",
        origin_country: "United States",
        longitude: -0.46,
        latitude: 51.47,
        velocity: 220,
        heading: 270,
        on_ground: false,
      },
    ];

    const renderTree = () => (
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
        </Routes>
      </MemoryRouter>
    );
    const { rerender } = render(renderTree());

    expect(screen.getByTestId("cinema-provider")).toHaveAttribute(
      "data-protagonist",
      "DL101",
    );
    expect(towerHarness.providerMounts).toBe(1);

    towerHarness.flights = [
      {
        icao24: "fff000",
        callsign: "QF009",
        origin_country: "Australia",
        longitude: 151.17,
        latitude: -33.94,
        velocity: 235,
        heading: 30,
        on_ground: false,
      },
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
      {
        icao24: "d4e5f6",
        callsign: "DL101",
        origin_country: "United States",
        longitude: -118.41,
        latitude: 33.94,
        velocity: 230,
        heading: 80,
        on_ground: false,
      },
      {
        icao24: "abcdef",
        callsign: "UA200",
        origin_country: "United States",
        longitude: -0.46,
        latitude: 51.47,
        velocity: 220,
        heading: 270,
        on_ground: false,
      },
    ];
    rerender(renderTree());

    expect(randomSpy).toHaveBeenCalledTimes(1);
    expect(storageGetSpy).not.toHaveBeenCalled();
    expect(storageSetSpy).not.toHaveBeenCalled();
    expect(cookieGetSpy).not.toHaveBeenCalled();
    expect(cookieSetSpy).not.toHaveBeenCalled();
    expect(towerHarness.providerMounts).toBe(1);
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
