import { act, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CinemaProvider,
  type CinemaProtagonist,
  useCinema,
} from "../components/cinema/CinemaContext";
import { EventChoreographer } from "../components/cinema/EventChoreographer";
import type {
  ChainBeamMoment,
  FlareLandMoment,
  ShockWaveMoment,
} from "../components/cinema/keyMoments";
import { ProtagonistBadge } from "../components/cinema/ProtagonistBadge";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  useEventStore,
  type AddCinemaEventInput,
  type CinemaEvent,
} from "../store/eventStore";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage?: (e: { data: string }) => void;
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

const demoProtagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

function Probe() {
  const cinema = useCinema();
  const protagonist = cinema.protagonist as
    | (CinemaProtagonist & { policyId?: string })
    | null;
  return (
    <>
      <div data-testid="kpi-tick-id">{cinema.kpiTickId}</div>
      <div data-testid="protagonist-policy-id">
        {protagonist?.policyId ?? ""}
      </div>
    </>
  );
}

interface EventChoreographerCallbacks {
  onClaimTriggered?: (moment: ShockWaveMoment) => void;
  onClaimSettled?: (moment: ChainBeamMoment) => void;
  onFlightLanded?: (moment: FlareLandMoment) => void;
  onPolicyCreated?: (event: CinemaEvent) => void;
}

const TestEventChoreographer =
  EventChoreographer as ComponentType<EventChoreographerCallbacks>;

function renderChoreographer(
  callbacks: EventChoreographerCallbacks = {},
  initialProtagonist: CinemaProtagonist | null = null,
) {
  render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <TestEventChoreographer {...callbacks} />
      <ProtagonistBadge />
      <Probe />
    </CinemaProvider>,
  );
}

function WsConsumer() {
  useWebSocket("/ws");
  return null;
}

function pushEvent(event: AddCinemaEventInput) {
  act(() => {
    useEventStore.getState().addEvent(event);
  });
}

describe("EventChoreographer", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(["claim.settled", "flare"] as const)(
    "routes %s to one KPI tick",
    (type) => {
      renderChoreographer();

      expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("0");

      pushEvent({
        id: `event-${type}`,
        type,
        payload: {
          flight_id: "BA178-20260614",
          policy_id: "p1",
          payout: 80,
        },
        receivedAt: 1,
      });

      expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("1");
    },
  );

  it("routes claim.triggered to the ShockWave callback without a KPI tick", () => {
    const onClaimTriggered = vi.fn();
    renderChoreographer({ onClaimTriggered });

    pushEvent({
      id: "claim-triggered-1",
      type: "claim.triggered",
      payload: {
        flight_id: "BA178-20260614",
        policy_id: "p1",
        delay_minutes: 47,
        airport_iata: "JFK",
        source: "demo",
      },
      receivedAt: 1,
    });

    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("0");
    expect(onClaimTriggered).toHaveBeenCalledTimes(1);
    expect(onClaimTriggered).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "claim-triggered-1:shockwave",
        kind: "shockwave",
        flightId: "BA178-20260614",
        policyId: "p1",
        delayMinutes: 47,
      }),
    );
  });

  it("routes claim.settled to ChainBeam callback while preserving one KPI tick per event id", () => {
    const onClaimSettled = vi.fn();
    renderChoreographer({ onClaimSettled });

    const payload = {
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 320,
      tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
      block_height: 9001,
      source: "demo",
    };

    pushEvent({
      id: "claim-settled-1",
      type: "claim.settled",
      payload,
      receivedAt: 1,
    });
    pushEvent({
      id: "claim-settled-2",
      type: "claim.settled",
      payload: {
        ...payload,
        policy_id: "p2",
        tx_hash: "0xabcdef1234567890abcdef1234567890abcdef12",
        block_height: 9002,
      },
      receivedAt: 2,
    });

    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("2");
    expect(onClaimSettled).toHaveBeenCalledTimes(2);
    expect(onClaimSettled).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: "claim-settled-1:chainbeam",
        kind: "chainbeam",
        flightId: "BA178-20260614",
        policyId: "p1",
        shortTxHash: "0x12345678...345678",
      }),
    );
    expect(onClaimSettled).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "claim-settled-2:chainbeam",
        kind: "chainbeam",
        policyId: "p2",
      }),
    );
  });

  it("routes flight.landed to FlareLand callback without rendering C3 effects", () => {
    const onFlightLanded = vi.fn();
    renderChoreographer({ onFlightLanded });

    pushEvent({
      id: "flight-landed-1",
      type: "flight.landed",
      payload: {
        flight_id: "BA178-20260614",
        policy_id: "p1",
        landed_at: 1_779_926_400_000,
        source: "demo",
      },
      receivedAt: 3,
    });

    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("0");
    expect(onFlightLanded).toHaveBeenCalledTimes(1);
    expect(onFlightLanded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "flight-landed-1:flareland",
        kind: "flareland",
        flightId: "BA178-20260614",
        policyId: "p1",
        landedAt: 1_779_926_400_000,
      }),
    );
    expect(screen.queryByTestId("heatmap-bg")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trail-draw")).not.toBeInTheDocument();
  });

  it("routes policy.created to the ambient callback without a KPI tick", () => {
    const onPolicyCreated = vi.fn();
    const onClaimTriggered = vi.fn();
    const onClaimSettled = vi.fn();
    const onFlightLanded = vi.fn();
    renderChoreographer({
      onClaimSettled,
      onClaimTriggered,
      onFlightLanded,
      onPolicyCreated,
    });

    pushEvent({
      id: "policy-created-ambient-1",
      type: "policy.created",
      payload: {
        source: "real",
        policy_id: "p-real",
        flight_id: "UA200",
        callsign: "UA200",
        longitude: -0.45,
        latitude: 51.47,
        created_at: 1_779_926_400_000,
      },
      receivedAt: 4,
    });

    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("0");
    expect(onPolicyCreated).toHaveBeenCalledTimes(1);
    expect(onPolicyCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "policy-created-ambient-1",
        type: "policy.created",
        payload: expect.objectContaining({
          policy_id: "p-real",
          flight_id: "UA200",
        }),
      }),
    );
    expect(onClaimTriggered).not.toHaveBeenCalled();
    expect(onClaimSettled).not.toHaveBeenCalled();
    expect(onFlightLanded).not.toHaveBeenCalled();
  });

  it("routes coordinate-less policy.created once for ambient handling", () => {
    const onPolicyCreated = vi.fn();
    renderChoreographer({ onPolicyCreated }, demoProtagonist);

    const payload = {
      source: "real",
      policy_id: "p-no-coordinates",
      flight_id: "UA200",
      callsign: "UA200",
      created_at: 1_779_926_400_000,
    };

    pushEvent({
      id: "policy-created-no-coordinates",
      type: "policy.created",
      payload,
      receivedAt: 5,
    });
    pushEvent({
      id: "policy-created-no-coordinates",
      type: "policy.created",
      payload,
      receivedAt: 6,
    });

    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("0");
    expect(onPolicyCreated).toHaveBeenCalledTimes(1);
    expect(onPolicyCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "policy-created-no-coordinates",
        type: "policy.created",
        payload: expect.objectContaining({
          policy_id: "p-no-coordinates",
        }),
      }),
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("DEMO");
  });

  it("does not protagonist-filter C2 callbacks and deduplicates repeated event ids", () => {
    const onClaimTriggered = vi.fn();
    renderChoreographer({ onClaimTriggered }, demoProtagonist);

    const nonCurrentPayload = {
      flight_id: "UA200",
      policy_id: "p-real",
      delay_minutes: 61,
      airport_iata: "LHR",
      source: "real",
    };

    pushEvent({
      id: "duplicate-trigger",
      type: "claim.triggered",
      payload: nonCurrentPayload,
      receivedAt: 1,
    });
    pushEvent({
      id: "duplicate-trigger",
      type: "claim.triggered",
      payload: nonCurrentPayload,
      receivedAt: 2,
    });

    expect(onClaimTriggered).toHaveBeenCalledTimes(1);
    expect(onClaimTriggered).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "duplicate-trigger:shockwave",
        kind: "shockwave",
        flightId: "UA200",
        policyId: "p-real",
      }),
    );
    expect(screen.queryByTestId("shockwave")).not.toBeInTheDocument();
  });

  it("promotes real policy.created from websocket immediately during establish", () => {
    render(
      <CinemaProvider initialProtagonist={demoProtagonist}>
        <WsConsumer />
        <EventChoreographer />
        <ProtagonistBadge />
      </CinemaProvider>,
    );

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "policy.created",
          payload: {
            source: "real",
            flight_id: "UA200",
            callsign: "UA200",
            longitude: -0.45,
            latitude: 51.47,
            created_at: Date.now(),
          },
        }),
      });
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("preserves policy_id from real policy.created on the active protagonist", () => {
    render(
      <CinemaProvider initialProtagonist={demoProtagonist}>
        <WsConsumer />
        <EventChoreographer />
        <ProtagonistBadge />
        <Probe />
      </CinemaProvider>,
    );

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "policy.created",
          payload: {
            source: "real",
            policy_id: "policy-real-123",
            flight_id: "UA200",
            callsign: "UA200",
            longitude: -0.45,
            latitude: 51.47,
            created_at: Date.now(),
          },
        }),
      });
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-policy-id")).toHaveTextContent(
      "policy-real-123",
    );
  });

  it("promotes real policy.created when backend sends created_at in seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

    render(
      <CinemaProvider initialProtagonist={demoProtagonist}>
        <WsConsumer />
        <EventChoreographer />
        <ProtagonistBadge />
      </CinemaProvider>,
    );

    const backendCreatedAtSeconds = Math.floor(Date.now() / 1000);

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "policy.created",
          payload: {
            source: "real",
            flight_id: "UA200",
            callsign: "UA200",
            longitude: -0.45,
            latitude: 51.47,
            created_at: backendCreatedAtSeconds,
          },
        }),
      });
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("keeps millisecond real policy.created eligible for takeover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderChoreographer({}, demoProtagonist);

    pushEvent({
      id: "policy-created-ms-fresh",
      type: "policy.created",
      payload: {
        source: "real",
        flight_id: "UA200",
        callsign: "UA200",
        longitude: -0.45,
        latitude: 51.47,
        created_at: Date.now(),
      },
      receivedAt: Date.now(),
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("falls back to receivedAt when real policy.created has a non-numeric created_at", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderChoreographer({}, demoProtagonist);

    pushEvent({
      id: "policy-created-created-at-string",
      type: "policy.created",
      payload: {
        source: "real",
        flight_id: "UA200",
        callsign: "UA200",
        longitude: -0.45,
        latitude: 51.47,
        created_at: "1779235200",
      },
      receivedAt: Date.now(),
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("drops stale real policy.created when an old created_at arrives in seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderChoreographer({}, demoProtagonist);

    pushEvent({
      id: "policy-created-old-seconds",
      type: "policy.created",
      payload: {
        source: "real",
        flight_id: "UA200",
        callsign: "UA200",
        longitude: -0.45,
        latitude: 51.47,
        created_at: Math.floor((Date.now() - 61_000) / 1000),
      },
      receivedAt: Date.now(),
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("DEMO");
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("BA178");
  });

  it("immediately promotes real policy.created during story and resets the demo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

    render(
      <CinemaProvider initialProtagonist={demoProtagonist}>
        <WsConsumer />
        <EventChoreographer />
        <ProtagonistBadge />
        <Probe />
      </CinemaProvider>,
    );

    act(() => vi.advanceTimersByTime(7_000));
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("DEMO");

    act(() => {
      MockWebSocket.instances[0].onmessage?.({
        data: JSON.stringify({
          type: "policy.created",
          payload: {
            source: "real",
            flight_id: "UA200",
            callsign: "UA200",
            longitude: -0.45,
            latitude: 51.47,
            created_at: Date.now(),
          },
        }),
      });
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
    expect(
      screen.queryByTestId("protagonist-queue-count"),
    ).not.toBeInTheDocument();
  });

  it("keeps stored events and KPI routing after real takeover resets transient visuals", () => {
    const onClaimTriggered = vi.fn();
    const onClaimSettled = vi.fn();
    renderChoreographer({ onClaimTriggered, onClaimSettled }, demoProtagonist);

    pushEvent({
      id: "claim-triggered-before-real",
      type: "claim.triggered",
      payload: {
        flight_id: "BA178",
        policy_id: "p-before-real",
        delay_minutes: 47,
        airport_iata: "JFK",
        source: "demo",
      },
      receivedAt: 1,
    });
    pushEvent({
      id: "policy-created-real-reset",
      type: "policy.created",
      payload: {
        source: "real",
        policy_id: "p-real",
        flight_id: "UA200",
        callsign: "UA200",
        longitude: -0.45,
        latitude: 51.47,
        created_at: Date.now(),
      },
      receivedAt: 2,
    });
    pushEvent({
      id: "claim-settled-after-real",
      type: "claim.settled",
      payload: {
        flight_id: "UA200",
        policy_id: "p-after-real",
        payout: 320,
        tx_hash: "0xabcdef1234567890abcdef1234567890abcdef12",
        block_height: 9002,
        source: "real",
      },
      receivedAt: 3,
    });

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("kpi-tick-id")).toHaveTextContent("1");
    expect(onClaimTriggered).toHaveBeenCalledTimes(1);
    expect(onClaimSettled).toHaveBeenCalledTimes(1);
    expect(useEventStore.getState().events.map((event) => event.id)).toEqual([
      "claim-settled-after-real",
      "policy-created-real-reset",
      "claim-triggered-before-real",
    ]);
  });
});
