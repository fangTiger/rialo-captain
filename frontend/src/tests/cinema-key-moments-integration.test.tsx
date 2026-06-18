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
import { apiFetch } from "../api/client";

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

async function renderTowerWithWs() {
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
  await flushPromises();
}

function pushWsEvent(type: string, payload: Record<string, unknown>) {
  act(() => {
    MockWebSocket.instances[0].onmessage?.({
      data: JSON.stringify({ type, payload }),
    });
  });
}

function pushWsBurst(events: { type: string; payload: Record<string, unknown> }[]) {
  act(() => {
    for (const event of events) {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify(event),
      });
    }
  });
}

function releaseKeyMomentTick() {
  act(() => vi.advanceTimersByTime(0));
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

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
          onPurchased?.({
            id: "policy-real-buy",
            flight_id: flightId,
            premium: 10,
            payout: 320,
            status: "active",
            contract_ref: "mock-policy-real-buy",
            created_at: Date.now(),
          });
          onClose();
        }}
      >
        confirm buy
      </button>
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

describe("TowerShell C2 key moments integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    MockWebSocket.instances = [];
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (path, init) => {
      if (path === "/seed-demo") {
        return {
          protagonist_name: "Alice",
          flight_id: "BA178-20260615",
          policy_ids: ["policy-demo-1"],
          policies_created: 1,
          claims_settled: 0,
        };
      }

      if (path === "/inject-delay") {
        const body =
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as { flight_id: string; delay_minutes: number })
            : { flight_id: "unknown", delay_minutes: 45 };
        return {
          flight_id: body.flight_id,
          delay_minutes: body.delay_minutes,
        };
      }

      return {};
    });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders ShockWave in the cinema overlay for current protagonist claim.triggered and cleans it up", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
    expect(screen.getByTestId("shockwave")).toHaveStyle({
      pointerEvents: "none",
    });

    act(() => vi.advanceTimersByTime(2_001));

    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
  });

  it("renders ShockWave at protagonist fallback coordinates when claim.triggered has no locator", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("clears active C2 moments when a real policy.created event takes over", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();
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

  it("injects delay for a REAL policy takeover and renders the backend closed-loop moments", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    apiFetchMock.mockClear();

    pushWsEvent("policy.created", {
      policy_id: "policy-real-1",
      flight_id: "UA200",
      callsign: "UA200",
      longitude: -0.45,
      latitude: 51.47,
      created_at: Date.now(),
      source: "real",
    });
    await flushPromises();

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200",
        delay_minutes: 45,
      }),
    });

    pushWsEvent("claim.triggered", {
      flight_id: "UA200",
      policy_id: "policy-real-1",
      delay_minutes: 47,
      airport_iata: "LHR",
      source: "real",
    });
    pushWsEvent("claim.settled", {
      flight_id: "UA200",
      policy_id: "policy-real-1",
      payout: 320,
      tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
      block_height: 9001,
      airport_iata: "LHR",
      source: "real",
    });
    pushWsEvent("flight.landed", {
      flight_id: "UA200",
      policy_id: "policy-real-1",
      landed_at: Date.now(),
      airport_iata: "LHR",
      source: "real",
    });
    await flushPromises();

    act(() => vi.advanceTimersByTime(5_999));
    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();
    expect(screen.getByTestId("chainbeam-tx")).toHaveTextContent(
      "0x12345678...345678",
    );

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("flareland")).toBeInTheDocument();
    expect(screen.getByTestId("flareland")).toHaveTextContent("FLARE");
  });

  it("turns the selected buy flight into the REAL protagonist and runs the closed-loop fallback", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    fireEvent.click(screen.getByTestId("mock-globe-gesture"));
    expect(screen.getByTestId("mode-indicator-state")).toHaveTextContent(
      "manual",
    );

    fireEvent.click(screen.getByTestId("mock-globe"));
    expect(screen.getByTestId("buy-drawer")).toHaveAttribute(
      "data-flight-id",
      "BA178-20260615",
    );

    apiFetchMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /confirm buy/i }));
    await flushPromises();

    expect(screen.queryByTestId("buy-drawer")).not.toBeInTheDocument();
    expect(screen.getByTestId("mode-indicator-state")).toHaveTextContent(
      "cinema",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("BA178");
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "BA178-20260615",
        delay_minutes: 45,
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(screen.getByTestId("traildraw-layer")).toContainElement(
      screen.getByTestId("trail-draw"),
    );

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();
    expect(
      Number(screen.getByTestId("kpi-band").getAttribute("data-tick-id")),
    ).toBeGreaterThan(0);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushPromises();
    releaseKeyMomentTick();
    expect(screen.getByTestId("flareland")).toBeInTheDocument();
  });

  it("runs the selected buy timeline even if inject-delay is still pending", async () => {
    apiFetchMock.mockImplementation(async (path) => {
      if (path === "/seed-demo") {
        return {
          protagonist_name: "Alice",
          flight_id: "BA178-20260615",
          policy_ids: ["policy-demo-1"],
          policies_created: 1,
          claims_settled: 0,
        };
      }

      if (path === "/inject-delay") {
        return new Promise(() => undefined);
      }

      return {};
    });

    await renderTowerWithWs();

    fireEvent.click(screen.getByTestId("mock-globe"));
    fireEvent.click(screen.getByRole("button", { name: /confirm buy/i }));
    await flushPromises();

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );

    await act(async () => {
      vi.advanceTimersByTime(4_000);
      await Promise.resolve();
    });
    expect(screen.getByTestId("traildraw-layer")).toContainElement(
      screen.getByTestId("trail-draw"),
    );

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushPromises();
    releaseKeyMomentTick();
    expect(screen.getByTestId("flareland")).toBeInTheDocument();
  });

  it("keeps closed-loop moments when REAL takeover and backend events arrive in one websocket burst", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    apiFetchMock.mockClear();

    pushWsBurst([
      {
        type: "policy.created",
        payload: {
          policy_id: "policy-real-burst",
          flight_id: "UA200",
          callsign: "UA200",
          longitude: -0.45,
          latitude: 51.47,
          created_at: Date.now(),
          source: "real",
        },
      },
      {
        type: "claim.triggered",
        payload: {
          flight_id: "UA200",
          policy_id: "policy-real-burst",
          delay_minutes: 47,
          airport_iata: "LHR",
          source: "real",
        },
      },
      {
        type: "claim.settled",
        payload: {
          flight_id: "UA200",
          policy_id: "policy-real-burst",
          payout: 320,
          tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
          block_height: 9001,
          airport_iata: "LHR",
          source: "real",
        },
      },
      {
        type: "flight.landed",
        payload: {
          flight_id: "UA200",
          policy_id: "policy-real-burst",
          landed_at: Date.now(),
          airport_iata: "LHR",
          source: "real",
        },
      },
    ]);
    await flushPromises();

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200",
        delay_minutes: 45,
      }),
    });

    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByTestId("flareland")).toBeInTheDocument();
  });

  it("uses REAL closed-loop fallback events when WebSocket is unavailable after inject-delay", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    apiFetchMock.mockClear();

    pushWsEvent("policy.created", {
      policy_id: "policy-real-no-fake",
      flight_id: "UA200",
      callsign: "UA200",
      longitude: -0.45,
      latitude: 51.47,
      created_at: Date.now(),
      source: "real",
    });
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200",
        delay_minutes: 45,
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(6_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
    });
    await flushPromises();
    releaseKeyMomentTick();
    expect(screen.getByTestId("flareland")).toBeInTheDocument();
  });

  it("renders ShockWave at protagonist fallback coordinates when airport locator is unknown", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178-20260615",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "ZZZ",
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("renders ShockWave for backend dated flight id using protagonist fallback coordinates", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178-20260615",
      policy_id: "policy-1",
      delay_minutes: 47,
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("shockwave"),
    );
  });

  it("renders ChainBeam for claim.settled while preserving the KPI tick", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(screen.getByTestId("kpi-band")).toHaveAttribute("data-tick-id", "0");

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.settled", {
      flight_id: "BA178",
      policy_id: "policy-1",
      payout: 320,
      tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
      block_height: 9001,
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();

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

  it("renders FlareLand for flight.landed and cleans it up", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("flight.landed", {
      flight_id: "BA178",
      policy_id: "policy-1",
      landed_at: Date.now(),
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("cinema-overlay")).toContainElement(
      screen.getByTestId("flareland"),
    );
    expect(screen.getByTestId("flareland")).toHaveTextContent("FLARE");

    act(() => vi.advanceTimersByTime(2_001));

    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();
  });

  it("keeps map navigation and manual gesture working while a C2 overlay moment is active", async () => {
    await renderTowerWithWs();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(6_000));
    pushWsEvent("claim.triggered", {
      flight_id: "BA178",
      policy_id: "policy-1",
      delay_minutes: 47,
      airport_iata: "JFK",
      source: "demo",
    });
    releaseKeyMomentTick();

    expect(screen.getByTestId("shockwave")).toBeInTheDocument();
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
    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
    expect(screen.getByTestId("location-probe")).toHaveTextContent("/");
    expect(
      screen.queryByText("flight detail BA178-20260615"),
    ).not.toBeInTheDocument();
  });
});
