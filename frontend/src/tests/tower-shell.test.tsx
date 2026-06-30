import { describe, it, expect, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { TowerShell } from "../routes/TowerShell";
import type { CameraTarget } from "../components/cinema/CinemaContext";
import type { FlightPublic } from "../hooks/useFlights";

interface TrailDrawMockOptions {
  userElectedFlight?: { callsign: string } | null;
  ttlMs?: number;
}

const SAFE_AREA_INSETS = {
  left: 500,
  right: 380,
  top: 260,
  bottom: 320,
};
const NARROW_SAFE_AREA_INSETS = {
  left: 500,
  right: 0,
  top: 0,
  bottom: 520,
};

const cinemaState = vi.hoisted(() => ({
  interrupt: vi.fn(),
  cameraTarget: null as CameraTarget | null,
  cycleId: 1,
  cycleStartedAt: new Date("2026-06-14T08:00:00.000Z").getTime(),
  cyclePromotionLocked: false,
  kpiTickId: 7,
  manualRemainingMs: 0,
  manualStartedAt: null,
  mode: "cinema" as const,
  phase: "story" as const,
  playbackLockedUntil: null,
  protagonist: {
    kind: "DEMO" as const,
    flightId: "BA178",
    callsign: "BA178",
    longitude: -73.78,
    latitude: 40.64,
    name: "Alice",
  },
  realInjectErrorUntil: null,
  realQueue: [],
  routeRealProtagonist: vi.fn(),
  setCyclePromotionLocked: vi.fn(),
  storyResetId: 0,
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
  ] as FlightPublic[],
}));

const buyDrawerHarness = vi.hoisted(() => ({
  purchaseRequests: 0,
  purchaseMode: "immediate" as "immediate" | "deferred",
  pendingComplete: null as null | (() => void),
  nextPolicy: {
    id: "policy-guided-1",
    premium: 12,
    payout: 60,
    status: "active",
    contract_ref: "mock-guided-1",
    created_at: new Date("2026-06-14T08:00:00.000Z").getTime(),
  },
}));

const trailHarness = vi.hoisted(() => ({
  useTrailDraw: vi.fn((options?: TrailDrawMockOptions) => {
    void options;
    return { activeTrail: null };
  }),
}));

const globeHarness = vi.hoisted(() => ({
  cameraTargets: [] as Array<CameraTarget | null>,
  viewportChangeHandlers: [] as Array<
    | ((viewport: { k: number; x: number; y: number }) => void)
    | undefined
  >,
}));

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
  stop: vi.fn(),
  openPanel: vi.fn(),
  isLoading: false,
  connectionStatus: "idle",
  activeSubjectType: "overview" as const,
  response: null as
    | {
        status: "ok" | "unavailable";
        answer: string;
        sources: { type: string; id: string; label: string; href?: string }[];
        suggested_prompts: string[];
        confidence: number;
        model: string;
      }
    | null,
  errorMessage: null as string | null,
  promptSuggestions: [
    "What needs attention right now?",
    "Which flights look payout-prone today?",
    "Where is settlement risk building?",
    "Which live flights are still uninsured?",
    "What should I verify first in evidence?",
  ],
}));

const keyMomentHarness = vi.hoisted(() => {
  const harness = {
    order: [] as string[],
    clearAllMoments: vi.fn(() => {
      harness.order.push("clear");
    }),
    enqueue: vi.fn(),
    resetForProtagonist: vi.fn(),
    useKeyMomentQueue: vi.fn(() => ({
      activeMoments: [],
      clearAllMoments: harness.clearAllMoments,
      enqueue: harness.enqueue,
      resetForProtagonist: harness.resetForProtagonist,
    })),
  };
  return harness;
});

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
  TRAIL_DRAW_START_MS: 0,
  TRAIL_DRAW_TTL_MS: 1000,
  useTrailDraw: trailHarness.useTrailDraw,
}));

vi.mock("../components/cinema/useKeyMomentQueue", () => ({
  useKeyMomentQueue: keyMomentHarness.useKeyMomentQueue,
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
    demoLocked,
    demoSelectionOffset,
    flights,
  }: {
    demoLocked?: boolean;
    demoSelectionOffset?: number;
    flights: unknown[];
  }) => (
    <div
      data-testid="auto-seeder"
      data-demo-locked={String(Boolean(demoLocked))}
      data-demo-selection-offset={demoSelectionOffset ?? "none"}
      data-flights={flights.length}
    />
  ),
}));

vi.mock("../components/cinema/EventChoreographer", () => ({
  EventChoreographer: () => <div data-testid="event-choreographer" />,
  normalizeCreatedAtMs: (createdAt: number | null | undefined, fallback: number) =>
    typeof createdAt === "number" ? createdAt : fallback,
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
    onPurchased,
  }: {
    flightId: string;
    onClose: () => void;
    onPurchased?: (policy: {
      id: string;
      flight_id: string;
      premium: number;
      payout: number;
      status: string;
      contract_ref: string;
      created_at: number;
    }) => void;
  }) => (
    <div data-testid="buy-drawer" data-flight-id={flightId}>
      buy drawer
      <button
        type="button"
        onClick={() => {
          buyDrawerHarness.purchaseRequests += 1;
          const completePurchase = () => {
            onPurchased?.({
              ...buyDrawerHarness.nextPolicy,
              flight_id: flightId,
            });
            onClose();
          };
          if (buyDrawerHarness.purchaseMode === "deferred") {
            buyDrawerHarness.pendingComplete = completePurchase;
            return;
          }
          completePurchase();
        }}
      >
        confirm purchase
      </button>
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
    cameraTarget?: CameraTarget | null;
    onViewportChange?: (viewport: { k: number; x: number; y: number }) => void;
    onUserGesture?: () => void;
    onSelectFlight?: (callsign: string) => void;
    protagonistHighlight?: { callsign: string } | null;
  }) => {
    globeHarness.cameraTargets.push(cameraTarget ?? null);
    globeHarness.viewportChangeHandlers.push(onViewportChange);

    return (
      <div>
        <button
          type="button"
          data-testid="mock-globe"
          data-camera-reason={cameraTarget?.reason ?? "none"}
          data-camera-longitude={cameraTarget?.longitude ?? "none"}
          data-camera-latitude={cameraTarget?.latitude ?? "none"}
          data-camera-zoom={cameraTarget?.zoom ?? "none"}
          data-camera-duration-ms={cameraTarget?.durationMs ?? "none"}
          data-protagonist-highlight={protagonistHighlight?.callsign ?? "none"}
          data-has-on-viewport-change={String(Boolean(onViewportChange))}
          onClick={() => onSelectFlight?.("BA178")}
        >
          mock globe
        </button>
        {towerHarness.flights.map((flight) => (
          <button
            key={flight.callsign}
            type="button"
            data-testid={`pick-${flight.callsign}`}
            onClick={() => onSelectFlight?.(flight.callsign)}
          >
            {`pick ${flight.callsign}`}
          </button>
        ))}
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
    );
  },
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

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
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
    cinemaState.routeRealProtagonist.mockReset();
    cinemaState.setCyclePromotionLocked.mockReset();
    cinemaState.protagonist = {
      kind: "DEMO",
      flightId: "BA178",
      callsign: "BA178",
      longitude: -73.78,
      latitude: 40.64,
      name: "Alice",
    };
    trailHarness.useTrailDraw.mockClear();
    trailHarness.useTrailDraw.mockImplementation(() => ({ activeTrail: null }));
    globeHarness.cameraTargets = [];
    globeHarness.viewportChangeHandlers = [];
    buyDrawerHarness.purchaseRequests = 0;
    buyDrawerHarness.purchaseMode = "immediate";
    buyDrawerHarness.pendingComplete = null;
    buyDrawerHarness.nextPolicy = {
      id: "policy-guided-1",
      premium: 12,
      payout: 60,
      status: "active",
      contract_ref: "mock-guided-1",
      created_at: new Date("2026-06-14T08:00:00.000Z").getTime(),
    };
    keyMomentHarness.order = [];
    keyMomentHarness.clearAllMoments.mockClear();
    keyMomentHarness.enqueue.mockClear();
    keyMomentHarness.resetForProtagonist.mockClear();
    keyMomentHarness.useKeyMomentQueue.mockClear();
    towerHarness.providerMounts = 0;
    copilotHarness.ask.mockReset();
    copilotHarness.stop.mockReset();
    copilotHarness.openPanel.mockReset();
    copilotHarness.isLoading = false;
    copilotHarness.connectionStatus = "idle";
    copilotHarness.activeSubjectType = "overview";
    copilotHarness.response = null;
    copilotHarness.errorMessage = null;
    copilotHarness.promptSuggestions = [
      "What needs attention right now?",
      "Which flights look payout-prone today?",
      "Where is settlement risk building?",
      "Which live flights are still uninsured?",
      "What should I verify first in evidence?",
    ];
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
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1200,
    });
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

    const lastCameraTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
          latitude: 40.64,
          longitude: -73.78,
        }),
      }),
    );
    expect(lastCameraTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
      safeAreaInsets: SAFE_AREA_INSETS,
    });
  });

  it("focuses the guided demo selection with a protagonist camera target while preserving trail draw", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    const lastCameraTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];
    const lastTrailOptions = trailHarness.useTrailDraw.mock.lastCall?.[0];

    expect(lastCameraTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
      safeAreaInsets: SAFE_AREA_INSETS,
    });
    expect(lastCameraTarget?.zoom ?? 0).toBeGreaterThan(1);
    expect(lastCameraTarget?.zoom ?? 99).toBeLessThanOrEqual(12);
    expect(lastCameraTarget?.durationMs ?? 0).toBeGreaterThanOrEqual(500);
    expect(lastCameraTarget?.durationMs ?? 9_999).toBeLessThanOrEqual(4_000);
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-camera-reason",
      "protagonist",
    );
    expect(lastTrailOptions?.ttlMs ?? 0).toBeGreaterThan(1_000);
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

  it("uses a bottom-rail safe-area target when guided demo runs on a narrow viewport", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 900,
    });

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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    const lastCameraTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    expect(screen.getByTestId("guided-demo-rail-container")).toHaveAttribute(
      "data-layout",
      "bottom",
    );
    expect(lastCameraTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
      safeAreaInsets: NARROW_SAFE_AREA_INSETS,
    });
  });

  it("refreshes the protagonist camera target when guided demo reselects the same or a different flight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
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
        icao24: "ua200x",
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    const firstTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    fireEvent.click(screen.getByRole("button", { name: "pick BA178" }));

    const repeatedTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    expect(repeatedTarget).not.toBe(firstTarget);
    expect(repeatedTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
    });

    fireEvent.click(screen.getByRole("button", { name: "pick UA200" }));

    const uaTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];
    const lastTrailOptions = trailHarness.useTrailDraw.mock.lastCall?.[0];

    expect(uaTarget).not.toBe(repeatedTarget);
    expect(uaTarget).toMatchObject({
      reason: "protagonist",
      longitude: -0.46,
      latitude: 51.47,
    });
    expect(lastTrailOptions?.ttlMs ?? 0).toBeGreaterThan(1_000);
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "UA200",
    );
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "UA200",
          latitude: 51.47,
          longitude: -0.46,
        }),
      }),
    );
  });

  it("keeps GlobeMap onViewportChange stable across selected-flight focus rerenders", () => {
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

    const initialHandler =
      globeHarness.viewportChangeHandlers[
        globeHarness.viewportChangeHandlers.length - 1
      ];

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    const focusedHandler =
      globeHarness.viewportChangeHandlers[
        globeHarness.viewportChangeHandlers.length - 1
      ];

    expect(focusedHandler).toBe(initialHandler);

    fireEvent.click(screen.getByTestId("mock-viewport-change"));

    const rerenderedHandler =
      globeHarness.viewportChangeHandlers[
        globeHarness.viewportChangeHandlers.length - 1
      ];

    expect(rerenderedHandler).toBe(focusedHandler);
  });

  it("keeps the one-shot camera target stable across live flight refreshes while trail uses latest elected flight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));

    const view = render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("mock globe"));

    const initialCameraTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    expect(initialCameraTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
    });

    towerHarness.flights = [
      {
        icao24: "a1b2c3",
        callsign: "BA178",
        origin_country: "United Kingdom",
        longitude: -71.25,
        latitude: 41.12,
        velocity: 255,
        heading: 96,
        on_ground: false,
      },
    ];

    view.rerender(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
        </Routes>
      </MemoryRouter>,
    );

    const refreshedCameraTarget =
      globeHarness.cameraTargets[globeHarness.cameraTargets.length - 1];

    expect(refreshedCameraTarget).toBe(initialCameraTarget);
    expect(refreshedCameraTarget).toMatchObject({
      reason: "protagonist",
      longitude: -73.78,
      latitude: 40.64,
    });
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
          longitude: -71.25,
          latitude: 41.12,
        }),
      }),
    );
  });

  it("fills the AI Briefing textarea from a recommendation and only asks on submit", () => {
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

    expect(screen.getByText("AI Briefing")).toBeInTheDocument();
    expect(screen.queryByText("ANSWER")).not.toBeInTheDocument();
    expect(screen.queryByText("ANSWER BUFFER")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit AI Briefing question" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What needs attention right now?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Which flights look payout-prone today?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Where is settlement risk building?",
      }),
    ).toBeInTheDocument();

    const textarea = screen.getByRole("textbox", {
      name: "AI Briefing question",
    });

    expect(textarea).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "What needs attention right now?" }));

    expect(textarea).toHaveValue("What needs attention right now?");
    expect(copilotHarness.ask).not.toHaveBeenCalled();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Submit AI Briefing question" }),
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith(
      {
        question: "What needs attention right now?",
        subjectType: "overview",
      },
      { openPanel: false },
    );
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
  });

  it("collapses and re-expands AI Briefing during streaming without triggering copilot actions", () => {
    copilotHarness.isLoading = true;
    copilotHarness.connectionStatus = "streaming";
    copilotHarness.response = {
      status: "ok",
      answer: "BA178 is building payout pressure right now.",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178 LHR->JFK",
          href: "/flights/BA178-20260614",
        },
      ],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    const briefing = screen.getByTestId("ai-briefing");
    const briefingBody = document.getElementById("ai-briefing-body");

    fireEvent.click(
      screen.getByRole("button", { name: "What needs attention right now?" }),
    );

    expect(briefing).toHaveAttribute("data-collapsed", "false");
    expect(briefing).toHaveStyle({ width: "min(100%, 28rem)" });
    expect(briefingBody).toBeInTheDocument();
    expect(briefingBody).not.toHaveAttribute("hidden");
    expect(
      screen.getByRole("button", { name: "Collapse AI Briefing" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Collapse AI Briefing" }),
    ).toHaveAttribute("aria-controls", "ai-briefing-body");
    expect(
      screen.getByRole("textbox", { name: "AI Briefing question" }),
    ).toHaveValue("What needs attention right now?");
    expect(
      screen.getByText("BA178 is building payout pressure right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("ANSWER BUFFER")).toBeInTheDocument();
    expect(screen.getByText("Receiving answer")).toBeInTheDocument();
    expect(screen.getAllByText("streaming")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Stop AI Briefing stream" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse AI Briefing" }),
    );

    expect(copilotHarness.ask).not.toHaveBeenCalled();
    expect(copilotHarness.stop).not.toHaveBeenCalled();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
    expect(briefing).toHaveAttribute("data-collapsed", "true");
    expect(briefing).toHaveStyle({ width: "fit-content" });
    expect(screen.getByText("AI Briefing")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand AI Briefing" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Expand AI Briefing" }),
    ).toHaveAttribute("aria-controls", "ai-briefing-body");
    expect(briefingBody).toHaveAttribute("hidden");
    expect(
      screen.queryByRole("textbox", { name: "AI Briefing question" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "What needs attention right now?" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("BA178 is building payout pressure right now."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("ANSWER BUFFER")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Stop AI Briefing stream" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Expand AI Briefing" }),
    );

    expect(copilotHarness.ask).not.toHaveBeenCalled();
    expect(copilotHarness.stop).not.toHaveBeenCalled();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
    expect(briefing).toHaveAttribute("data-collapsed", "false");
    expect(briefingBody).not.toHaveAttribute("hidden");
    expect(
      screen.getByRole("button", { name: "Collapse AI Briefing" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("textbox", { name: "AI Briefing question" }),
    ).toHaveValue("What needs attention right now?");
    expect(
      screen.getByRole("button", { name: "What needs attention right now?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("BA178 is building payout pressure right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("ANSWER BUFFER")).toBeInTheDocument();
    expect(screen.getByText("Receiving answer")).toBeInTheDocument();
    expect(screen.getAllByText("streaming")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Stop AI Briefing stream" }),
    ).toBeInTheDocument();
  });

  it("submits AI Briefing inline without opening the panel", () => {
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

    fireEvent.change(screen.getByRole("textbox", { name: "AI Briefing question" }), {
      target: { value: "Where is settlement risk building?" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit AI Briefing question" }),
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith(
      {
        question: "Where is settlement risk building?",
        subjectType: "overview",
      },
      { openPanel: false },
    );
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
  });

  it("caps AI Briefing recommendations at five and shows inline answer buffer state while streaming", () => {
    copilotHarness.isLoading = true;
    copilotHarness.connectionStatus = "streaming";
    copilotHarness.promptSuggestions = [
      "Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
      "Question 6",
    ];
    copilotHarness.response = {
      status: "ok",
      answer: "Tower is already streaming BA178 risk.",
      sources: [],
      suggested_prompts: [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
        "Question 6",
      ],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    expect(
      screen.getByText("Tower is already streaming BA178 risk."),
    ).toBeInTheDocument();
    expect(screen.getByText("ANSWER BUFFER")).toBeInTheDocument();
    expect(screen.queryByText("ANSWER")).not.toBeInTheDocument();
    expect(screen.getByText("Receiving answer")).toBeInTheDocument();
    expect(screen.getByText("▌")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Stop AI Briefing stream" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Question 6" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Question 5" })).toBeInTheDocument();
  });

  it("shows ANSWER for a completed AI Briefing response instead of the streaming buffer label", () => {
    copilotHarness.response = {
      status: "ok",
      answer: "Tower activity is elevated around BA178 and EK202 today.",
      sources: [],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    expect(
      screen.getByText("Tower activity is elevated around BA178 and EK202 today."),
    ).toBeInTheDocument();
    expect(screen.getByText("ANSWER")).toBeInTheDocument();
    expect(screen.queryByText("ANSWER BUFFER")).not.toBeInTheDocument();
    expect(screen.queryByText("Receiving answer")).not.toBeInTheDocument();
  });

  it("renders completed AI Briefing answers inside a stable scroll container", () => {
    copilotHarness.response = {
      status: "ok",
      answer:
        "Tower activity is elevated around BA178 and EK202 today. BA178 has the stronger claim pressure signal while EK202 still needs manual evidence review.",
      sources: [],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    const answerScroll = screen.getByTestId("ai-briefing-answer-scroll");

    expect(answerScroll).toHaveClass("ai-briefing-answer-scroll");
    expect(answerScroll).toHaveStyle({
      overflowY: "auto",
      maxHeight: "260px",
    });
  });

  it("lets AI Briefing stop a streaming inline request without opening the panel", () => {
    copilotHarness.isLoading = true;
    copilotHarness.connectionStatus = "streaming";
    copilotHarness.response = {
      status: "ok",
      answer: "Tower is already streaming BA178 risk.",
      sources: [],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    fireEvent.click(
      screen.getByRole("button", { name: "Stop AI Briefing stream" }),
    );

    expect(copilotHarness.stop).toHaveBeenCalledTimes(1);
    expect(copilotHarness.ask).not.toHaveBeenCalled();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
  });

  it("lets AI Briefing replace a streaming inline request from a recommendation without opening the panel", () => {
    copilotHarness.isLoading = true;
    copilotHarness.connectionStatus = "streaming";
    copilotHarness.promptSuggestions = [
      "Question 1",
      "Question 2",
      "Question 3",
      "Question 4",
      "Question 5",
      "Question 6",
    ];
    copilotHarness.response = {
      status: "ok",
      answer: "Tower is already streaming BA178 risk.",
      sources: [],
      suggested_prompts: [
        "Question 1",
        "Question 2",
        "Question 3",
        "Question 4",
        "Question 5",
      ],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    fireEvent.click(screen.getByRole("button", { name: "Question 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Submit AI Briefing question" }),
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith(
      {
        question: "Question 2",
        subjectType: "overview",
      },
      { openPanel: false },
    );
    expect(copilotHarness.stop).not.toHaveBeenCalled();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
  });

  it("shows AI Briefing evidence used only when the answer cites matching evidence", () => {
    copilotHarness.response = {
      status: "ok",
      answer: "BA178 is the flight I would watch first right now.",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178 LHR->JFK",
          href: "/flights/BA178-20260614",
        },
        {
          type: "claim",
          id: "claim-one",
          label: "Claim claim-one",
          href: "/claims/claim-one/timeline",
        },
      ],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    expect(
      screen.getByText("BA178 is the flight I would watch first right now."),
    ).toBeInTheDocument();
    expect(screen.getByText("Evidence used")).toBeInTheDocument();
    expect(screen.getByText("Flight BA178 LHR->JFK")).toBeInTheDocument();
    expect(screen.queryByText("Claim claim-one")).not.toBeInTheDocument();
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
  });

  it("hides AI Briefing evidence when the answer does not cite any source", () => {
    copilotHarness.response = {
      status: "ok",
      answer: "Tower activity is elevated today.",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178 LHR->JFK",
          href: "/flights/BA178-20260614",
        },
      ],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };

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

    expect(screen.getByText("Tower activity is elevated today.")).toBeInTheDocument();
    expect(screen.queryByText("Evidence used")).not.toBeInTheDocument();
    expect(screen.queryByText("Flight BA178 LHR->JFK")).not.toBeInTheDocument();
  });

  it("keeps the AI Briefing partial answer on error without showing evidence used", () => {
    copilotHarness.response = {
      status: "unavailable",
      answer: "BA178 is still the flight I would watch first right now.",
      sources: [
        {
          type: "flight",
          id: "BA178-20260614",
          label: "Flight BA178 LHR->JFK",
          href: "/flights/BA178-20260614",
        },
      ],
      suggested_prompts: [],
      confidence: 0,
      model: "deepseek-v4-pro",
    };
    copilotHarness.errorMessage = "DeepSeek request timed out. Please try again.";

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

    expect(
      screen.getByText("BA178 is still the flight I would watch first right now."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("DeepSeek request timed out. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("Recoverable error")).toBeInTheDocument();
    expect(screen.queryByText("ANSWER")).not.toBeInTheDocument();
    expect(screen.queryByText("ANSWER BUFFER")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence used")).not.toBeInTheDocument();
    expect(screen.queryByText("Flight BA178 LHR->JFK")).not.toBeInTheDocument();
  });

  it("uses the top-nav height token instead of a hard-coded offset", () => {
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

    expect(screen.getByTestId("cinema-provider").parentElement).toHaveStyle({
      top: "var(--top-nav-height, 64px)",
    });
  });

  it("clears active key moments before rendering the selected flight focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    trailHarness.useTrailDraw.mockImplementation((options) => {
      if (options?.userElectedFlight) {
        keyMomentHarness.order.push(
          `trail:${options.userElectedFlight.callsign}`,
        );
      }
      return { activeTrail: null };
    });

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

    fireEvent.click(screen.getByText("mock globe"));

    expect(keyMomentHarness.order.slice(0, 2)).toEqual(["clear", "trail:BA178"]);
  });

  it("cancels the selected flight lock when the buy drawer closes", () => {
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
    expect(screen.getByTestId("auto-seeder")).toHaveAttribute(
      "data-demo-locked",
      "false",
    );

    fireEvent.click(screen.getByText("mock globe"));

    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "BA178",
    );
    expect(screen.getByTestId("auto-seeder")).toHaveAttribute(
      "data-demo-locked",
      "true",
    );
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: expect.objectContaining({
          callsign: "BA178",
        }),
        userElectedTrailToken: expect.any(Number),
      }),
    );
    fireEvent.click(screen.getByText("close drawer"));

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "DL101",
    );
    expect(screen.getByTestId("auto-seeder")).toHaveAttribute(
      "data-demo-locked",
      "false",
    );
    expect(trailHarness.useTrailDraw).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userElectedFlight: null,
      }),
    );
  });

  it("starts guided demo with a recommended highlight and does not purchase a policy", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );

    expect(screen.getByText("Recommended flight")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use recommended flight" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-globe")).toHaveAttribute(
      "data-protagonist-highlight",
      "BA178",
    );
    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(buyDrawerHarness.purchaseRequests).toBe(0);
  });

  it("opens buy cover for the recommended or a different demo flight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
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
        icao24: "ua200x",
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260614",
    );
    expect(screen.getByText("Selected flight")).toBeInTheDocument();

    fireEvent.click(screen.getByText("close drawer"));
    fireEvent.click(screen.getByRole("button", { name: "pick UA200" }));

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "UA200-20260614",
    );
    expect(screen.getAllByText("UA200")[0]).toBeInTheDocument();
  });

  it("pauses demo context on close and resumes the same selected flight", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );
    fireEvent.click(screen.getByText("close drawer"));

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(buyDrawerHarness.purchaseRequests).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260614",
    );
  });

  it("enters settlement replay after purchase and routes the purchase as a REAL protagonist", () => {
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );
    fireEvent.click(screen.getByText("confirm purchase"));

    expect(screen.getByText("Policy policy-guided-1")).toBeInTheDocument();
    expect(screen.getByText("12 RIA")).toBeInTheDocument();
    expect(screen.getByText("60 RIA")).toBeInTheDocument();
    expect(cinemaState.routeRealProtagonist).toHaveBeenCalledWith(
      expect.objectContaining({
        callsign: "BA178",
        flightId: "BA178-20260614",
        policyId: "policy-guided-1",
      }),
      expect.objectContaining({
        playbackLockMs: expect.any(Number),
      }),
    );
    expect(buyDrawerHarness.purchaseRequests).toBe(1);
  });

  it("keeps guided demo active through manual gestures and replacing the selected flight without remounting the provider", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
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
        icao24: "ua200x",
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );
    fireEvent.click(screen.getByText("close drawer"));
    fireEvent.click(screen.getByText("mock user gesture"));

    expect(cinemaState.interrupt).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "pick UA200" }));

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "UA200-20260614",
    );
    expect(towerHarness.providerMounts).toBe(1);
  });

  it("does not reactivate the rail after exit when a delayed purchase success arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    buyDrawerHarness.purchaseMode = "deferred";

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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );
    fireEvent.click(screen.getByText("confirm purchase"));

    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260614",
    );

    fireEvent.click(screen.getByText("close drawer"));
    fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));

    expect(
      screen.getByRole("button", { name: "Start guided demo" }),
    ).toBeInTheDocument();

    act(() => {
      buyDrawerHarness.pendingComplete?.();
    });

    expect(
      screen.getByRole("button", { name: "Start guided demo" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Policy policy-guided-1")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit demo" })).not.toBeInTheDocument();
  });

  it("ignores a delayed purchase from an exited guided demo after a new demo starts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    buyDrawerHarness.purchaseMode = "deferred";

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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );
    fireEvent.click(screen.getByText("confirm purchase"));
    const staleCompletePurchase = buyDrawerHarness.pendingComplete;

    fireEvent.click(screen.getByText("close drawer"));
    fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use recommended flight" }),
    );

    act(() => {
      staleCompletePurchase?.();
    });

    expect(screen.queryByText("Policy policy-guided-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260614",
    );
    expect(screen.getByRole("button", { name: "Exit demo" })).toBeInTheDocument();
  });

  it("shows waiting state when no projectable flight is available and does not enter buy cover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));
    towerHarness.flights = [
      {
        icao24: "nogeo01",
        callsign: "BA178",
        origin_country: "United Kingdom",
        longitude: null,
        latitude: null,
        velocity: 240,
        heading: 90,
        on_ground: true,
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

    fireEvent.click(
      screen.getByRole("button", { name: "Start guided demo" }),
    );

    expect(screen.getByText("Waiting for live flight")).toBeInTheDocument();
    expect(screen.getByText("No recommendation")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use recommended flight" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("mock globe"));
    fireEvent.click(screen.getByRole("button", { name: "pick BA178" }));

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for live flight")).toBeInTheDocument();
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
