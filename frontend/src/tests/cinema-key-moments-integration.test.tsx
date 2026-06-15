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

describe("TowerShell C2 key moments integration", () => {
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

  it("renders ShockWave in the cinema overlay for current protagonist claim.triggered and cleans it up", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
    expect(screen.getByTestId("shockwave")).toHaveStyle({
      pointerEvents: "none",
    });

    act(() => vi.advanceTimersByTime(2_001));

    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
  });

  it("renders ShockWave at protagonist fallback coordinates when claim.triggered has no locator", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      source: "demo",
    });

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("clears active C2 moments when a real policy.created event takes over", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    pushWsEvent("policy.created", {
      policy_id: "policy-real-1",
      flight_id: "UA200",
      callsign: "UA200",
      longitude: -0.45,
      latitude: 51.47,
      created_at: Date.now(),
      source: "real",
    });

    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chainbeam")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("renders ShockWave at protagonist fallback coordinates when airport locator is unknown", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178-20260615",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "ZZZ",
      source: "demo",
    });

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("renders ShockWave for backend dated flight id using protagonist fallback coordinates", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178-20260615",
      policy_id: "policy-1",
      delay_minutes: 47,
      source: "demo",
    });

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("renders ChainBeam for claim.settled while preserving the KPI tick", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(screen.getByTestId("kpi-band")).toHaveAttribute("data-tick-id", "0");

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.settled", {
      flight_id: "BA178",
      policy_id: "policy-1",
      payout: 320,
      tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
      block_height: 9001,
      airport_iata: "JFK",
      source: "demo",
    });

    expect(screen.getByTestId("kpi-band")).toHaveAttribute("data-tick-id", "1");
    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("chainbeam"),
    );
    expect(screen.getByTestId("chainbeam-tx")).toHaveTextContent(
      "0x12345678...345678",
    );

    act(() => vi.advanceTimersByTime(4_001));

    expect(screen.queryByTestId("chainbeam")).not.toBeInTheDocument();
  });

  it("renders FlareLand for flight.landed and cleans it up", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("flight.landed", {
      flight_id: "BA178",
      policy_id: "policy-1",
      landed_at: Date.now(),
      airport_iata: "JFK",
      source: "demo",
    });

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("flareland"),
    );
    expect(screen.getByTestId("flareland")).toHaveTextContent("FLARE");

    act(() => vi.advanceTimersByTime(2_001));

    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();
  });

  it("keeps map navigation and manual gesture working while a C2 overlay moment is active", () => {
    renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(15_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });

    expect(screen.getByTestId("shockwave")).toBeInTheDocument();
    expect(screen.getByTestId("cinema-overlay")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByTestId("mock-globe-gesture"));
    expect(screen.getByTestId("mode-indicator")).toHaveTextContent("MANUAL");

    fireEvent.click(screen.getByTestId("mock-globe"));
    expect(screen.getByText("flight detail BA178-20260615")).toBeInTheDocument();
  });
});
