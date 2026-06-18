import { describe, expect, it } from "vitest";
import {
  advanceCinemaState,
  createInitialCinemaState,
  routeRealProtagonistState,
  type CinemaPhase,
} from "../components/cinema/cinemaMachine";
import {
  chooseDemoProtagonist,
  createRealQueueState,
  queuedMoreCount,
  routeRealProtagonistEvent,
  type DemoFlightCandidate,
  type RealProtagonistEvent,
} from "../components/cinema/protagonist";

const now = new Date("2026-06-15T00:00:00.000Z").getTime();

function event(id: string, createdAt = now): RealProtagonistEvent {
  return {
    id,
    flightId: `${id}-20260615`,
    callsign: id,
    longitude: -73.78,
    latitude: 40.64,
    createdAt,
    source: "real",
  };
}

function eventWithPolicy(
  id: string,
  policyId: string,
  createdAt = now,
): RealProtagonistEvent {
  return {
    ...event(id, createdAt),
    policyId,
  };
}

function demoFlight(
  callsign: string,
  overrides: Partial<DemoFlightCandidate> = {},
): DemoFlightCandidate {
  return {
    callsign,
    longitude: -73.78,
    latitude: 40.64,
    on_ground: false,
    ...overrides,
  };
}

describe("DEMO protagonist rotation", () => {
  it("rotates across available demo candidates by index and loops after the last candidate", () => {
    const flights = [
      demoFlight("DEMO-A"),
      demoFlight("DEMO-B", { longitude: -0.4, latitude: 51.4 }),
      demoFlight("DEMO-C", { longitude: 139.8, latitude: 35.5 }),
    ];

    expect(chooseDemoProtagonist(flights, 0)?.callsign).toBe("DEMO-A");
    expect(chooseDemoProtagonist(flights, 1)?.callsign).toBe("DEMO-B");
    expect(chooseDemoProtagonist(flights, 2)?.callsign).toBe("DEMO-C");
    expect(chooseDemoProtagonist(flights, 3)?.callsign).toBe("DEMO-A");
  });

  it("rotates only through positioned airborne candidates with usable ETA", () => {
    const flights = [
      demoFlight("ON-GROUND", { on_ground: true }),
      demoFlight("DEMO-A"),
      demoFlight("NO-LON", { longitude: null }),
      demoFlight("NO-LAT", { latitude: null }),
      demoFlight("ETA-TOO-SOON", { etaMinutes: 4 }),
      demoFlight("ETA-TOO-LATE", { etaMinutes: 16 }),
      demoFlight("DEMO-B", { longitude: -0.4, latitude: 51.4, etaMinutes: 5 }),
      demoFlight("DEMO-C", { longitude: 139.8, latitude: 35.5, etaMinutes: 15 }),
    ];

    expect(chooseDemoProtagonist(flights, 0)?.callsign).toBe("DEMO-A");
    expect(chooseDemoProtagonist(flights, 1)?.callsign).toBe("DEMO-B");
    expect(chooseDemoProtagonist(flights, 2)?.callsign).toBe("DEMO-C");
    expect(chooseDemoProtagonist(flights, 3)?.callsign).toBe("DEMO-A");
  });
});

describe("REAL protagonist queue", () => {
  it.each(["establish", "rest", "story", "zoom-in", "zoom-out"] as const)(
    "helper promotes real events immediately during %s",
    (phase) => {
      const result = routeRealProtagonistEvent({
        phase,
        now,
        event: event("REAL1"),
        queueState: createRealQueueState(),
      });

      expect(result.active).toMatchObject({
        kind: "REAL",
        flightId: "REAL1-20260615",
        callsign: "REAL1",
      });
      expect(result.queueState.queue).toHaveLength(0);
      expect(result.ignored).toBe(false);
    },
  );

  it.each(["story", "zoom-in", "zoom-out"] as const)(
    "cinema machine immediately takes over real events during %s",
    (phase) => {
      const state = {
        ...createInitialCinemaState(now - 10_000),
        phase,
        cycleStartedAt: now - 10_000,
      };
      const result = routeRealProtagonistState(state, event("REAL2"), now);

      expect(result.protagonist).toMatchObject({
        kind: "REAL",
        flightId: "REAL2-20260615",
        callsign: "REAL2",
      });
      expect(result.realQueue).toHaveLength(0);
      expect(result.phase).toBe("establish");
      expect(result.cycleStartedAt).toBe(now);
      expect(result.cameraTarget).toBeNull();
    },
  );

  it.each(["establish", "rest", "story", "zoom-in", "zoom-out"] as const)(
    "cinema machine can immediately take over real events during %s",
    (phase: CinemaPhase) => {
      const state = {
        ...createInitialCinemaState(now - 10_000),
        phase,
        cycleStartedAt: now - 10_000,
      };
      const result = routeRealProtagonistState(state, event("REAL3"), now);

      expect(result.protagonist?.callsign).toBe("REAL3");
      expect(result.phase).toBe("establish");
      expect(result.cycleStartedAt).toBe(now);
      expect(result.cameraTarget).toBeNull();
    },
  );

  it("increments a story reset token when real takeover resets the cycle", () => {
    const state = {
      ...createInitialCinemaState(now - 10_000),
      phase: "story" as const,
      cycleStartedAt: now - 10_000,
      storyResetId: 4,
    };

    const result = routeRealProtagonistState(state, event("REAL4"), now) as
      | typeof state
      | (typeof state & { storyResetId: number });

    expect(result.storyResetId).toBe(5);
    expect(result.protagonist?.callsign).toBe("REAL4");
  });

  it("returns from manual mode when a user-purchased real flight takes over", () => {
    const state = {
      ...createInitialCinemaState(now - 10_000, null, "interactive"),
      manualStartedAt: now - 5_000,
      manualRemainingMs: 25_000,
    };

    const result = routeRealProtagonistState(
      state,
      eventWithPolicy("REAL5", "policy-real-5"),
      now,
    );

    expect(result.mode).toBe("cinema");
    expect(result.manualStartedAt).toBeNull();
    expect(result.manualRemainingMs).toBe(0);
    expect(result.phase).toBe("establish");
    expect(result.protagonist).toMatchObject({
      kind: "REAL",
      callsign: "REAL5",
      policyId: "policy-real-5",
    });
  });

  it("takes the first real event at 0ms and queues burst events before 1000ms", () => {
    const first = routeRealProtagonistState(
      createInitialCinemaState(now - 5_000),
      event("REAL0"),
      now,
    ) as ReturnType<typeof routeRealProtagonistState> & {
      lastRealTakeoverAt: number | null;
    };

    expect(first.protagonist?.callsign).toBe("REAL0");
    expect(first.lastRealTakeoverAt).toBe(now);

    const second = routeRealProtagonistState(
      first,
      event("REAL999", now + 999),
      now + 999,
    ) as ReturnType<typeof routeRealProtagonistState> & {
      lastRealTakeoverAt: number | null;
    };

    expect(second.protagonist?.callsign).toBe("REAL0");
    expect(second.lastRealTakeoverAt).toBe(now);
    expect(second.realQueue.map((queued) => queued.id)).toEqual(["REAL999"]);
  });

  it("ignores duplicate real events for the active policy during a burst", () => {
    const first = routeRealProtagonistState(
      createInitialCinemaState(now - 5_000),
      eventWithPolicy("REAL0", "policy-real-0"),
      now,
    );

    const duplicate = routeRealProtagonistState(
      first,
      eventWithPolicy("REAL0-replay", "policy-real-0", now + 500),
      now + 500,
    );

    expect(duplicate.protagonist?.callsign).toBe("REAL0");
    expect(duplicate.realQueue).toHaveLength(0);
  });

  it("preserves policyId when a queued real event becomes protagonist on the next cycle", () => {
    const first = routeRealProtagonistState(
      createInitialCinemaState(now - 5_000),
      eventWithPolicy("REAL0", "policy-real-0"),
      now,
    );
    const queued = routeRealProtagonistState(
      first,
      eventWithPolicy("REAL999", "policy-real-999", now + 999),
      now + 999,
    );

    const promoted = advanceCinemaState(queued, now + 30_000);

    expect(promoted.protagonist).toMatchObject({
      kind: "REAL",
      flightId: "REAL999-20260615",
      callsign: "REAL999",
      policyId: "policy-real-999",
    });
    expect(promoted.realQueue).toHaveLength(0);
  });

  it("does not promote queued real events at a cycle boundary while manual focus is locked", () => {
    const initial = {
      ...createInitialCinemaState(now - 5_000, {
        kind: "DEMO" as const,
        flightId: "BA178",
        callsign: "BA178",
        longitude: -73.78,
        latitude: 40.64,
      }),
      realQueue: [eventWithPolicy("REAL999", "policy-real-999", now + 999)],
      cyclePromotionLocked: true,
    };

    const advanced = advanceCinemaState(initial, now + 30_000);

    expect(advanced.protagonist?.callsign).toBe("BA178");
    expect(advanced.realQueue).toHaveLength(1);
    expect(advanced.cycleId).toBeGreaterThan(initial.cycleId);
  });

  it.each([1_000, 1_001])(
    "allows a new immediate real takeover at %sms after the previous takeover",
    (offsetMs) => {
      const state = {
        ...createInitialCinemaState(now - 5_000),
        protagonist: {
          kind: "REAL" as const,
          flightId: "REAL0-20260615",
          callsign: "REAL0",
          longitude: -73.78,
          latitude: 40.64,
        },
        lastRealTakeoverAt: now,
      };

      const result = routeRealProtagonistState(
        state,
        event(`REAL${offsetMs}`, now + offsetMs),
        now + offsetMs,
      ) as ReturnType<typeof routeRealProtagonistState> & {
        lastRealTakeoverAt: number | null;
      };

      expect(result.protagonist?.callsign).toBe(`REAL${offsetMs}`);
      expect(result.lastRealTakeoverAt).toBe(now + offsetMs);
      expect(result.realQueue).toHaveLength(0);
    },
  );

  it("does not treat replayed real events as a burst when their creation times are apart", () => {
    const replayedFirst = routeRealProtagonistState(
      createInitialCinemaState(now - 5_000),
      event("OLDREAL", now - 30_000),
      now,
    );

    const replayedSecond = routeRealProtagonistState(
      replayedFirst,
      event("NEWREAL", now - 2_000),
      now + 1,
    );

    expect(replayedSecond.protagonist?.callsign).toBe("NEWREAL");
    expect(replayedSecond.realQueue).toHaveLength(0);
  });

  it("keeps at most three queued events and discards the oldest FIFO entry", () => {
    const queueState = createRealQueueState(
      ["R1", "R2", "R3", "R4"].map((id) => event(id)),
    );

    expect(queueState.queue.map((queued) => queued.id)).toEqual([
      "R2",
      "R3",
      "R4",
    ]);
    expect(queuedMoreCount(queueState)).toBe(3);
  });

  it("ignores real events older than the 60s wall-clock lookback", () => {
    const result = routeRealProtagonistEvent({
      phase: "establish",
      now,
      event: event("OLD", now - 61_000),
      queueState: createRealQueueState(),
    });

    expect(result.ignored).toBe(true);
    expect(result.active).toBeNull();
    expect(result.queueState.queue).toHaveLength(0);
  });

  it("drops stale real events before burst queue handling", () => {
    const state = {
      ...createInitialCinemaState(now - 5_000),
      protagonist: {
        kind: "REAL" as const,
        flightId: "REAL0-20260615",
        callsign: "REAL0",
        longitude: -73.78,
        latitude: 40.64,
      },
      lastRealTakeoverAt: now,
    };

    const result = routeRealProtagonistState(
      state,
      event("OLD-BURST", now - 61_000),
      now + 500,
    );

    expect(result.protagonist?.callsign).toBe("REAL0");
    expect(result.realQueue).toHaveLength(0);
    expect(result.storyResetId).toBe(state.storyResetId);
    expect(result.lastRealTakeoverAt).toBe(now);
  });
});
