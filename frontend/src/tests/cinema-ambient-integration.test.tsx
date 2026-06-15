import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";

import { TowerShell } from "../routes/TowerShell";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEventStore } from "../store/eventStore";

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

function renderTowerWithWs() {
  render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <WsConsumer />
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

vi.mock("../components/tower/GlobeMap", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    GlobeMap: ({
      onViewportChange,
      onUserGesture,
      onSelectFlight,
    }: {
      onViewportChange?: (viewport: { k: number; x: number; y: number }) => void;
      onUserGesture?: () => void;
      onSelectFlight?: (callsign: string) => void;
    }) => {
      React.useEffect(() => {
        onViewportChange?.({ k: 1, x: 0, y: 0 });
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
    MockWebSocket.instances = [];
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
      vi.advanceTimersByTime(7_000);
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
    expect(screen.getByText("flight detail BA178-20260615")).toBeInTheDocument();
  });

  it("renders TrailDraw at STORY start and cleans it up at the 10 second mark", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(6_999);
    });
    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("trail-draw")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();
  });

  it("clears active TrailDraw immediately when a real policy.created event takes over", () => {
    renderTowerWithWs();

    act(() => {
      vi.advanceTimersByTime(7_000);
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
      vi.advanceTimersByTime(15_000);
    });
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });

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
