import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";

import { TowerShell } from "../routes/TowerShell";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEventStore } from "../store/eventStore";
import { projectLonLat } from "../components/cinema/cameraMath";
import { estimateLivePosition } from "../components/cinema/flightMotion";

const globeHarness = vi.hoisted(() => ({
  size: { width: 1200, height: 720 },
}));
const copilotHarness = vi.hoisted(() => ({
  activeSubjectType: "overview" as const,
  ask: vi.fn(),
  connectionStatus: "idle" as const,
  errorMessage: null as string | null,
  isLoading: false,
  openPanel: vi.fn(),
  promptSuggestions: [] as string[],
  response: null,
  stop: vi.fn(),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage?: (event: { data: string }) => void;
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;

  constructor() {
    MockWebSocket.instances.push(this);
  }

  send() {}
  close() {
    this.onclose?.();
  }
}

function WsConsumer() {
  useWebSocket("/ws");
  return null;
}

function FlightDetailProbe() {
  const { id } = useParams();
  return <div>flight detail {id}</div>;
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

function renderTowerWithWs() {
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <WsConsumer />
      <LocationProbe />
      <Routes>
        <Route path="/" element={<TowerShell />} />
        <Route path="/flight/:id" element={<FlightDetailProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

function pushWsEvent(type: string, payload: Record<string, unknown>) {
  act(() => {
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ type, payload }),
    });
  });
}

function releaseKeyMomentTick() {
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

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

vi.mock("../components/cinema/AutoSeeder", () => ({
  AutoSeeder: () => null,
}));

vi.mock("../components/cinema/CinemaController", () => ({
  CinemaController: () => null,
}));

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

vi.mock("../components/tower/GlobeMap", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    GlobeMap: ({
      onViewportChange,
      onUserGesture,
      onSelectFlight,
    }: {
      onViewportChange?: (
        viewport: { k: number; x: number; y: number },
        size: { width: number; height: number },
      ) => void;
      onUserGesture?: () => void;
      onSelectFlight?: (callsign: string) => void;
    }) => {
      React.useEffect(() => {
        onViewportChange?.({ k: 1, x: 0, y: 0 }, globeHarness.size);
      }, [onViewportChange]);

      return (
        <div>
          <button
            data-testid="mock-globe"
            onClick={() => onSelectFlight?.("BA178")}
            type="button"
          >
            mock globe
          </button>
          <button
            data-testid="mock-globe-gesture"
            onClick={() => onUserGesture?.()}
            type="button"
          >
            mock gesture
          </button>
        </div>
      );
    },
  };
});

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

vi.mock("../components/tower/RadarSweep", () => ({
  RadarSweep: () => <div data-testid="radar-sweep" />,
}));

vi.mock("../components/tower/EventFeedSidebar", () => ({
  EventFeedSidebar: () => <div data-testid="event-feed" />,
}));

vi.mock("../components/tower/KPIBand", () => ({
  KPIBand: ({ tickId }: { tickId?: number }) => (
    <div data-testid="kpi-band" data-tick-id={tickId ?? 0} />
  ),
}));

vi.mock("../components/tower/DataStaleBadge", () => ({
  DataStaleBadge: () => <div data-testid="data-stale" />,
}));

describe("TowerShell C3 ambient integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    globeHarness.size = { width: 1200, height: 720 };
    MockWebSocket.instances = [];
    copilotHarness.ask.mockReset();
    copilotHarness.openPanel.mockReset();
    copilotHarness.stop.mockReset();
    copilotHarness.activeSubjectType = "overview";
    copilotHarness.connectionStatus = "idle";
    copilotHarness.errorMessage = null;
    copilotHarness.isLoading = false;
    copilotHarness.promptSuggestions = [];
    copilotHarness.response = null;
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("adds a HeatmapBg focus when policy.created arrives from WebSocket", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(screen.getByTestId("heatmap-bg")).toBeInTheDocument();
    expect(screen.queryAllByTestId("heatmap-focus")).toHaveLength(0);

    pushWsEvent("policy.created", {
      policy_id: "policy-real-1",
      flight_id: "BA178",
      source: "real",
      created_at: Date.now(),
      longitude: -73.78,
      latitude: 40.64,
      callsign: "BA178",
    });

    expect(screen.queryAllByTestId("heatmap-focus")).toHaveLength(1);
  });

  it("keeps map navigation and manual gesture working while ambient layers are active", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByTestId("trail-draw")).toBeInTheDocument();
    expect(screen.getByTestId("map-atmosphere-layer")).toHaveStyle({
      pointerEvents: "none",
    });
    expect(screen.getByTestId("cinema-overlay")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByTestId("mock-globe-gesture"));
    expect(screen.getByTestId("mode-indicator")).toHaveTextContent("MANUAL");

    fireEvent.click(screen.getByTestId("mock-globe"));
    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260615",
    );
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
    expect(
      screen.queryByText("flight detail BA178-20260615"),
    ).not.toBeInTheDocument();
  });

  it("renders TrailDraw at the 4 second gate and cleans it up at the 5 second mark", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(3_999);
    });
    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("trail-draw")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();
  });

  it("projects TrailDraw with the actual map size reported by GlobeMap", () => {
    globeHarness.size = { width: 1600, height: 900 };
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    const path = screen.getByTestId("trail-draw-path").getAttribute("d") ?? "";
    const coords = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g)).map((match) =>
      Number(match[0]),
    );
    const lastX = coords.at(-2);
    const lastY = coords.at(-1);
    const livePosition = estimateLivePosition(
      {
        longitude: -73.78,
        latitude: 40.64,
        velocity: 240,
        heading: 90,
      },
      4,
    );
    if (!livePosition || lastX === undefined || lastY === undefined) {
      throw new Error(`missing trail endpoint in ${path}`);
    }
    const expected = projectLonLat(
      livePosition.longitude,
      livePosition.latitude,
      globeHarness.size,
    );

    expect(lastX).toBeCloseTo(expected.x, 3);
    expect(lastY).toBeCloseTo(expected.y, 3);
  });

  it("clears active TrailDraw immediately when a real policy.created event takes over", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.getByTestId("trail-draw")).toBeInTheDocument();

    pushWsEvent("policy.created", {
      policy_id: "policy-real-1",
      flight_id: "UA200",
      callsign: "UA200",
      longitude: -0.45,
      latitude: 51.47,
      created_at: Date.now(),
      source: "real",
    });

    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("keeps the TrailDraw layer below C2 key moments", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();
    expect(screen.getByTestId("traildraw-layer")).toHaveStyle({
      zIndex: "1",
    });
    expect(screen.getByTestId("key-moment-layer")).toHaveStyle({
      zIndex: "2",
    });

    const overlayChildren = Array.from(
      screen.getByTestId("cinema-overlay").children,
    );
    expect(overlayChildren.indexOf(screen.getByTestId("traildraw-layer"))).toBeLessThan(
      overlayChildren.indexOf(screen.getByTestId("key-moment-layer")),
    );
  });
});
