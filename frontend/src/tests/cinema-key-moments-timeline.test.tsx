import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { TowerShell } from "../routes/TowerShell";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEventStore } from "../store/eventStore";
import { useKeyMomentQueue } from "../components/cinema/useKeyMomentQueue";
import type { CinemaPhase } from "../components/cinema/CinemaContext";
import type { KeyMoment } from "../components/cinema/keyMoments";

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

function renderTower() {
  return render(
    <MemoryRouter
      initialEntries={["/"]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <WsConsumer />
      <Routes>
        <Route path="/" element={<TowerShell />} />
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

function pushStoredEvent({
  id,
  type,
  payload,
  receivedAt,
}: {
  id: string;
  type: "claim.triggered";
  payload: Record<string, unknown>;
  receivedAt: number;
}) {
  act(() => {
    useEventStore.getState().addEvent({ id, type, payload, receivedAt });
  });
}

function currentProtagonistTrigger(id: string) {
  return {
    flight_id: "BA178",
    policy_id: id,
    delay_minutes: 47,
    airport_iata: "JFK",
    source: "demo",
  };
}

function currentProtagonistSettled(id: string) {
  return {
    flight_id: "BA178",
    policy_id: id,
    payout: 320,
    tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
    block_height: 9001,
    airport_iata: "JFK",
    source: "demo",
  };
}

function currentProtagonistLanded(id: string) {
  return {
    flight_id: "BA178",
    policy_id: id,
    landed_at: Date.now(),
    airport_iata: "JFK",
    source: "demo",
  };
}

function shockwaveMoment({
  id,
  flightId = "BA178-20260615",
}: {
  id: string;
  flightId?: string;
}): KeyMoment {
  return {
    id: `${id}:shockwave`,
    eventId: id,
    kind: "shockwave",
    flightId,
    policyId: `policy-${id}`,
    delayMinutes: 47,
    source: "demo",
    receivedAt: Date.now(),
    locator: { kind: "airport", airportIata: "JFK" },
  };
}

function QueueProbe({
  phase = "story",
  protagonistFlightId = "BA178-20260615",
}: {
  phase?: CinemaPhase;
  protagonistFlightId?: string | null;
}) {
  const queue = useKeyMomentQueue({
    cycleStartedAt: new Date("2026-06-15T00:00:00.000Z").getTime(),
    phase,
    protagonistFlightId,
  });

  return (
    <div>
      <div data-testid="queue-active">
        {queue.activeMoments.map((active) => active.moment.id).join(",") ||
          "none"}
      </div>
      <button
        type="button"
        onClick={() => queue.enqueue(shockwaveMoment({ id: "active" }))}
      >
        enqueue active
      </button>
      <button
        type="button"
        onClick={() =>
          queue.enqueue(
            shockwaveMoment({
              id: "pending",
              flightId: "UA200-20260615",
            }),
          )
        }
      >
        enqueue pending
      </button>
      <button type="button" onClick={() => queue.clearAllMoments()}>
        clear all
      </button>
    </div>
  );
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
    }: {
      onViewportChange?: (viewport: { k: number; x: number; y: number }) => void;
    }) => {
      React.useEffect(() => {
        onViewportChange?.({ k: 1, x: 0, y: 0 });
      }, [onViewportChange]);

      return <div data-testid="mock-globe" />;
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

describe("TowerShell C2 STORY timeline", () => {
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

  it("holds claim.triggered until the exact 4s STORY window", () => {
    renderTower();
    expect(MockWebSocket.instances).toHaveLength(1);

    pushWsEvent("claim.triggered", currentProtagonistTrigger("policy-1"));

    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3_999));
    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();
  });

  it("releases ChainBeam 2s after ShockWave starts and FlareLand 2s after ChainBeam starts", () => {
    renderTower();
    expect(MockWebSocket.instances).toHaveLength(1);

    pushWsEvent("claim.triggered", currentProtagonistTrigger("policy-1"));
    pushWsEvent("claim.settled", currentProtagonistSettled("policy-1"));
    pushWsEvent("flight.landed", currentProtagonistLanded("policy-1"));

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();
    expect(screen.queryByTestId("chainbeam")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_999));
    expect(screen.queryByTestId("chainbeam")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();
    expect(screen.getByTestId("chainbeam-tx")).toHaveTextContent(
      "0x12345678...345678",
    );
    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_998));
    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("chainbeam")).toBeInTheDocument();
    expect(screen.getByTestId("flareland")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2_001));
    expect(screen.queryByTestId("flareland")).not.toBeInTheDocument();
  });

  it("clears timeline timers on unmount", () => {
    const { unmount } = renderTower();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    pushWsEvent("claim.triggered", currentProtagonistTrigger("policy-1"));
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByTestId("shockwave")).toBeInTheDocument();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("caps burst moments at the latest six and keeps stale or non-protagonist events pending or dropped", () => {
    renderTower();
    expect(MockWebSocket.instances).toHaveLength(1);

    for (let index = 0; index < 10; index += 1) {
      pushWsEvent("claim.triggered", {
        ...currentProtagonistTrigger(`policy-${index}`),
        delay_minutes: 40 + index,
      });
    }
    pushWsEvent("claim.triggered", {
      flight_id: "UA200",
      policy_id: "policy-other",
      delay_minutes: 99,
      airport_iata: "LHR",
      source: "real",
    });
    pushStoredEvent({
      id: "old-trigger",
      type: "claim.triggered",
      payload: {
        ...currentProtagonistTrigger("policy-old"),
        delay_minutes: 88,
      },
      receivedAt: Date.now() - 61_000,
    });

    act(() => vi.advanceTimersByTime(4_000));

    expect(screen.getAllByTestId("shockwave")).toHaveLength(6);
    for (let delay = 40; delay <= 43; delay += 1) {
      expect(screen.queryByText(`${delay}M DELAY`)).not.toBeInTheDocument();
    }
    for (let delay = 44; delay <= 49; delay += 1) {
      expect(screen.getByText(`${delay}M DELAY`)).toBeInTheDocument();
    }
    expect(screen.queryByText("88M DELAY")).not.toBeInTheDocument();
    expect(screen.queryByText("99M DELAY")).not.toBeInTheDocument();
  });
});

describe("useKeyMomentQueue reset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases pending moments on the 100ms queue tick", () => {
    vi.useFakeTimers();
    const cycleStartedAt = new Date("2026-06-15T00:00:00.000Z").getTime();
    vi.setSystemTime(cycleStartedAt + 3_900);

    render(<QueueProbe />);

    fireEvent.click(screen.getByRole("button", { name: /enqueue active/i }));
    expect(screen.getByTestId("queue-active")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(99));
    expect(screen.getByTestId("queue-active")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("queue-active")).toHaveTextContent(
      "active:shockwave",
    );
  });

  it("clears active and pending moments when a real takeover reset arrives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:15.000Z"));

    const { rerender } = render(<QueueProbe />);

    fireEvent.click(screen.getByRole("button", { name: /enqueue active/i }));
    expect(screen.getByTestId("queue-active")).toHaveTextContent(
      "active:shockwave",
    );

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(screen.getByTestId("queue-active")).toHaveTextContent("none");

    fireEvent.click(screen.getByRole("button", { name: /enqueue pending/i }));
    expect(screen.getByTestId("queue-active")).toHaveTextContent("none");

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    rerender(<QueueProbe protagonistFlightId="UA200-20260615" />);
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByTestId("queue-active")).toHaveTextContent("none");
  });
});
