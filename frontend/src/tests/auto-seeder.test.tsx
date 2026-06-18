import { act, render, screen } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import {
  CinemaProvider,
  useCinema,
  type CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import { CinemaController } from "../components/cinema/CinemaController";
import type { CinemaMode } from "../components/cinema/cinemaMachine";
import { AutoSeeder } from "../components/cinema/AutoSeeder";
import { ModeIndicator } from "../components/cinema/ModeIndicator";
import { chooseDemoProtagonist } from "../components/cinema/protagonist";
import { useEventStore } from "../store/eventStore";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const liveFlights = [
  {
    callsign: "BA178",
    longitude: -73.78,
    latitude: 40.64,
    on_ground: false,
    etaMinutes: 9,
  },
];

const rotatingFlights = [
  {
    callsign: "BA178",
    longitude: -73.78,
    latitude: 40.64,
    on_ground: false,
    etaMinutes: 9,
  },
  {
    callsign: "DL101",
    longitude: -0.4,
    latitude: 51.4,
    on_ground: false,
    etaMinutes: 10,
  },
  {
    callsign: "UA200",
    longitude: -122.4,
    latitude: 37.6,
    on_ground: false,
    etaMinutes: 11,
  },
];

const initialProtagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

const realProtagonist: CinemaProtagonist = {
  kind: "REAL",
  flightId: "UA200-20260615",
  callsign: "UA200",
  longitude: -122.4,
  latitude: 37.6,
  policyId: "policy-real-active",
};

const queuedRealEvent = {
  id: "policy-real-queued",
  flightId: "DL101-20260615",
  callsign: "DL101",
  longitude: -0.4,
  latitude: 51.4,
  createdAt: new Date("2026-06-15T00:00:00.000Z").getTime(),
  policyId: "policy-real-queued",
  source: "real" as const,
};

function ProtagonistProbe() {
  const cinema = useCinema();
  return (
    <>
      <div data-testid="protagonist-kind">{cinema.protagonist?.kind}</div>
      <div data-testid="protagonist-callsign">
        {cinema.protagonist?.callsign}
      </div>
      <div data-testid="protagonist-name">{cinema.protagonist?.name}</div>
      <div data-testid="real-queue-count">{cinema.realQueue.length}</div>
    </>
  );
}

function renderAutoSeeder(initialMode?: CinemaMode) {
  return render(
    <CinemaProvider initialMode={initialMode}>
      <CinemaController />
      <AutoSeeder flights={liveFlights} />
    </CinemaProvider>,
  );
}

function renderAutoSeederWithProbe() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <AutoSeeder flights={liveFlights} />
      <ProtagonistProbe />
    </CinemaProvider>,
  );
}

function renderAutoSeederWithRotatingProbe() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <AutoSeeder flights={rotatingFlights} demoSelectionOffset={2} />
      <ProtagonistProbe />
    </CinemaProvider>,
  );
}

function realAutoSeederTree(delayMinutes = 45) {
  return (
    <CinemaProvider initialProtagonist={realProtagonist}>
      <CinemaController />
      <AutoSeeder
        delayMinutes={delayMinutes}
        flights={rotatingFlights}
        demoSelectionOffset={1}
      />
      <ProtagonistProbe />
    </CinemaProvider>
  );
}

function renderAutoSeederWithRealProtagonist(
  delayMinutes = 45,
  initialMode?: CinemaMode,
) {
  return render(
    <CinemaProvider
      initialMode={initialMode}
      initialProtagonist={realProtagonist}
    >
      <CinemaController />
      <AutoSeeder
        delayMinutes={delayMinutes}
        flights={rotatingFlights}
        demoSelectionOffset={1}
      />
      <ProtagonistProbe />
    </CinemaProvider>,
  );
}

function renderAutoSeederWithRealFailureIndicator() {
  return render(
    <CinemaProvider initialProtagonist={realProtagonist}>
      <CinemaController />
      <AutoSeeder flights={rotatingFlights} />
      <ModeIndicator />
      <ProtagonistProbe />
    </CinemaProvider>,
  );
}

function QueueSetupThenAutoSeeder() {
  const cinema = useCinema();
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    cinema.routeRealProtagonist({
      ...queuedRealEvent,
      id: "policy-real-active",
      flightId: "UA200-20260615",
      callsign: "UA200",
      longitude: -122.4,
      latitude: 37.6,
    });
    cinema.routeRealProtagonist(queuedRealEvent);
    cinema.setDemoProtagonist(initialProtagonist);
    setReady(true);
  }, [cinema]);

  return (
    <>
      {ready ? (
        <AutoSeeder flights={rotatingFlights} demoSelectionOffset={1} />
      ) : null}
      <ProtagonistProbe />
    </>
  );
}

function renderAutoSeederWithQueuedReal() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <QueueSetupThenAutoSeeder />
    </CinemaProvider>,
  );
}

function RealBurstThenAutoSeeder() {
  const cinema = useCinema();
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    cinema.routeRealProtagonist({
      ...queuedRealEvent,
      id: "policy-real-active",
      flightId: "UA200-20260615",
      callsign: "UA200",
      longitude: -122.4,
      latitude: 37.6,
      policyId: "policy-real-active",
    });
    cinema.routeRealProtagonist(queuedRealEvent);
    setReady(true);
  }, [cinema]);

  return (
    <>
      {ready ? <AutoSeeder flights={rotatingFlights} /> : null}
      <ProtagonistProbe />
    </>
  );
}

function RealTakeoverBeforeDemoInject() {
  const { routeRealProtagonist } = useCinema();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const id = window.setTimeout(() => {
      routeRealProtagonist({
        id: "policy-real-before-demo-inject",
        flightId: "UA200-20260615",
        callsign: "UA200",
        longitude: -122.4,
        latitude: 37.6,
        createdAt: Date.now(),
        policyId: "policy-real-before-demo-inject",
        source: "real",
      });
    }, 1_000);

    return () => window.clearTimeout(id);
  }, [routeRealProtagonist]);

  return (
    <>
      <AutoSeeder flights={liveFlights} />
      <ProtagonistProbe />
    </>
  );
}

function renderAutoSeederWithRealTakeoverBeforeDemoInject() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <RealTakeoverBeforeDemoInject />
    </CinemaProvider>,
  );
}

function renderAutoSeederWithRealBurst() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <RealBurstThenAutoSeeder />
    </CinemaProvider>,
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("chooseDemoProtagonist", () => {
  it("selects the first airborne flight with coordinates and a suitable ETA", () => {
    const protagonist = chooseDemoProtagonist(
      [
        {
          callsign: "LANDED",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: true,
          etaMinutes: 8,
        },
        {
          callsign: "NOCOORD",
          longitude: null,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 8,
        },
        {
          callsign: "EARLY",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 3,
        },
        {
          callsign: "LATE",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 25,
        },
        {
          callsign: "BA178",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 9,
        },
      ],
      0,
    );

    expect(protagonist).toMatchObject({
      kind: "DEMO",
      flightId: "BA178",
      callsign: "BA178",
      longitude: -73.78,
      latitude: 40.64,
      name: "Alice",
    });
  });

  it("accepts flights without ETA because the current live API does not expose ETA", () => {
    const protagonist = chooseDemoProtagonist(
      [
        {
          callsign: "UA200",
          longitude: -0.45,
          latitude: 51.47,
          on_ground: false,
        },
      ],
      1,
    );

    expect(protagonist).toMatchObject({
      callsign: "UA200",
      name: "Bob",
    });
  });

  it("returns null when every flight is landed, unpositioned, or outside ETA window", () => {
    const protagonist = chooseDemoProtagonist([
      {
        callsign: "GROUND",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: true,
        etaMinutes: 10,
      },
      {
        callsign: "MISSING",
        longitude: 2.35,
        latitude: null,
        on_ground: false,
        etaMinutes: 10,
      },
      {
        callsign: "TOOFAST",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: false,
        etaMinutes: 2,
      },
      {
        callsign: "TOOSLOW",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: false,
        etaMinutes: 30,
      },
    ]);

    expect(protagonist).toBeNull();
  });
});

describe("AutoSeeder", () => {
  afterEach(() => {
    vi.useRealTimers();
    apiFetchMock.mockReset();
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
  });

  it("seeds during establish and injects delay at the 3s mark", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    renderAutoSeeder();
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        user_email: "captain@local.dev",
        protagonist_name: "Alice",
        flight_id: "BA178",
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(2_999);
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "BA178-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("synthesizes the demo closed-loop events when WebSocket is unavailable", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "retrying" });
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    renderAutoSeeder();
    await flushPromises();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(useEventStore.getState().events).toHaveLength(0);
    expect(useEventStore.getState().flares).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(useEventStore.getState().events.map((event) => event.type)).toEqual([
      "claim.triggered",
    ]);
    expect(useEventStore.getState().flares).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(useEventStore.getState().flares).toHaveLength(1);
    expect(useEventStore.getState().flares[0]).toMatchObject({
      flight_id: "BA178-20260615",
      policy_id: "p1",
      payout: 320,
      delay_minutes: 45,
    });
    expect(useEventStore.getState().events.map((event) => event.type)).toEqual([
      "flare",
      "claim.settled",
      "claim.triggered",
    ]);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    const state = useEventStore.getState();
    expect(state.events.map((event) => event.type)).toEqual([
      "flight.landed",
      "flare",
      "claim.settled",
      "claim.triggered",
    ]);
    expect(state.events.map((event) => event.payload.policy_id)).toEqual(
      Array.from({ length: 4 }, () => "p1"),
    );
  });

  it("does not synthesize demo events when WebSocket is open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "open" });
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    renderAutoSeeder();
    await flushPromises();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    const state = useEventStore.getState();
    expect(state.flares).toHaveLength(0);
    expect(state.events).toHaveLength(0);
  });

  it("dedupes seed and inject by cycleId across React rerenders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    const { rerender } = renderAutoSeeder();
    await flushPromises();

    rerender(
      <CinemaProvider>
        <CinemaController />
        <AutoSeeder flights={[...liveFlights]} />
      </CinemaProvider>,
    );
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    rerender(
      <CinemaProvider>
        <CinemaController />
        <AutoSeeder flights={[...liveFlights]} />
      </CinemaProvider>,
    );
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["interactive", "paused-hidden", "degraded"] as const)(
    "does not call APIs while mode is %s",
    async (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

      renderAutoSeeder(mode);
      await flushPromises();
      await act(async () => {
        vi.advanceTimersByTime(3_000);
        await Promise.resolve();
      });

      expect(apiFetchMock).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["interactive", () => window.dispatchEvent(new MouseEvent("click"))],
    ["paused-hidden", () => setVisibilityState("hidden")],
  ] as const)(
    "clears the pending DEMO inject timer when cinema becomes %s before 3s",
    async (_mode, interrupt) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
      apiFetchMock.mockResolvedValueOnce({
        protagonist_name: "Alice",
        flight_id: "BA178-20260615",
        policy_ids: ["p1"],
        policies_created: 1,
        claims_settled: 0,
      });

      renderAutoSeeder();
      await flushPromises();

      expect(apiFetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      await act(async () => {
        interrupt();
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(2_000);
        await Promise.resolve();
      });

      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("marks the current demo protagonist offline when seed-demo fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockRejectedValueOnce(new Error("seed unavailable"));

    renderAutoSeederWithProbe();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent(
      "DEMO_OFFLINE",
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("writes the selected rotating demo protagonist back into cinema state before seeding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Carol",
      flight_id: "UA200-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });

    renderAutoSeederWithRotatingProbe();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("DEMO");
    expect(screen.getByTestId("protagonist-callsign")).toHaveTextContent(
      "UA200",
    );
    expect(screen.getByTestId("protagonist-name")).toHaveTextContent("Carol");
    expect(apiFetchMock).toHaveBeenCalledWith("/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        user_email: "captain@local.dev",
        protagonist_name: "Carol",
        flight_id: "UA200",
      }),
    });
  });

  it("does not run the stale DEMO inject after a REAL takeover resets the cycle", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p-demo"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    renderAutoSeederWithRealTakeoverBeforeDemoInject();
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("injects delay immediately for an active REAL protagonist without seeding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    renderAutoSeederWithRealProtagonist();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(screen.getByTestId("protagonist-callsign")).toHaveTextContent(
      "UA200",
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/seed-demo",
      expect.anything(),
    );
  });

  it("dedupes the same REAL protagonist across effect reruns", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    const { rerender } = renderAutoSeederWithRealProtagonist(45);
    await flushPromises();

    rerender(realAutoSeederTree(60));
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("injects each REAL burst item only when it becomes the current protagonist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    renderAutoSeederWithRealBurst();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(screen.getByTestId("protagonist-callsign")).toHaveTextContent(
      "UA200",
    );
    expect(screen.getByTestId("real-queue-count")).toHaveTextContent("1");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("protagonist-callsign")).toHaveTextContent(
      "DL101",
    );
    expect(screen.getByTestId("real-queue-count")).toHaveTextContent("0");
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "DL101-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("defers REAL inject while interactive and runs it after cinema resumes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    renderAutoSeederWithRealProtagonist(45, "interactive");
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(apiFetchMock).not.toHaveBeenCalled();

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("defers REAL inject while hidden and runs it when visible again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      flight_id: "UA200-20260615",
      delay_minutes: 45,
    });

    renderAutoSeederWithRealProtagonist(45, "paused-hidden");
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(apiFetchMock).not.toHaveBeenCalled();

    act(() => setVisibilityState("visible"));
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("shows a transient mode warning when REAL inject-delay fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockRejectedValueOnce(new Error("inject failed"));

    renderAutoSeederWithRealFailureIndicator();
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mode-indicator-label")).toHaveTextContent(
      "REAL · INJECT FAILED",
    );
    expect(screen.getByTestId("mode-indicator-state")).toHaveTextContent(
      "real-inject-failed",
    );
  });

  it("does not retry the same REAL inject key after a failed request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockRejectedValueOnce(new Error("inject failed"));

    const { rerender } = renderAutoSeederWithRealProtagonist(45);
    await flushPromises();

    rerender(realAutoSeederTree(60));
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("REAL");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "UA200-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("does not seed or overwrite a queued REAL story", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValue({
      protagonist_name: "Bob",
      flight_id: "DL101-20260615",
      policy_ids: ["p-demo"],
      policies_created: 1,
      claims_settled: 0,
    });

    renderAutoSeederWithQueuedReal();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent("DEMO");
    expect(screen.getByTestId("protagonist-callsign")).toHaveTextContent(
      "BA178",
    );
    expect(screen.getByTestId("real-queue-count")).toHaveTextContent("1");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
