import { afterEach, describe, expect, it, vi } from "vitest";
import {
  advanceKeyMomentTimeline,
  createKeyMomentTimelineState,
  enqueueKeyMoment,
} from "../components/cinema/keyMomentTimeline";
import type { KeyMoment } from "../components/cinema/keyMoments";

const cycleStartedAt = new Date("2026-06-15T00:00:00.000Z").getTime();

function shockwave(id: string, receivedAt = cycleStartedAt + 12_000): KeyMoment {
  return {
    id: `${id}:shockwave`,
    eventId: id,
    kind: "shockwave",
    flightId: "BA178-20260615",
    policyId: `pol-${id}`,
    delayMinutes: 45,
    source: "mock",
    receivedAt,
    locator: { kind: "airport", airportIata: "JFK" },
  };
}

function chainbeam(id: string, receivedAt = cycleStartedAt + 12_000): KeyMoment {
  return {
    id: `${id}:chainbeam`,
    eventId: id,
    kind: "chainbeam",
    flightId: "BA178-20260615",
    policyId: "pol-trigger",
    txHash: "0x1234567890abcdef1234567890abcdef12345678",
    shortTxHash: "0x12345678...345678",
    source: "mock",
    receivedAt,
  };
}

function flareland(id: string, receivedAt = cycleStartedAt + 12_000): KeyMoment {
  return {
    id: `${id}:flareland`,
    eventId: id,
    kind: "flareland",
    flightId: "BA178-20260615",
    policyId: "pol-trigger",
    landedAt: receivedAt,
    source: "mock",
    receivedAt,
  };
}

function advanceAt(
  state: ReturnType<typeof createKeyMomentTimelineState>,
  elapsedMs: number,
) {
  vi.setSystemTime(cycleStartedAt + elapsedMs);
  return advanceKeyMomentTimeline(state, {
    now: Date.now(),
    phase: "story",
    cycleStartedAt,
    protagonistFlightId: "BA178-20260615",
  });
}

describe("key moment timeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases trigger exactly at the 5s STORY window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, shockwave("trigger"));

    state = advanceAt(state, 4_999);
    expect(state.active).toHaveLength(0);

    state = advanceAt(state, 5_000);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "shockwave",
    ]);
    expect(state.active[0].startedAt).toBe(cycleStartedAt + 5_000);
  });

  it("releases settled 1s after ShockWave and landed 2s after ChainBeam", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, shockwave("trigger"));
    state = enqueueKeyMoment(state, chainbeam("settled"));
    state = enqueueKeyMoment(state, flareland("landed"));

    state = advanceAt(state, 5_000);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "shockwave",
    ]);

    state = advanceAt(state, 5_999);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "shockwave",
    ]);

    state = advanceAt(state, 6_000);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "shockwave",
      "chainbeam",
    ]);

    state = advanceAt(state, 7_999);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "chainbeam",
    ]);

    state = advanceAt(state, 8_000);
    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "chainbeam",
      "flareland",
    ]);
  });

  it("plays ChainBeam in STORY even when matching ShockWave is absent", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, chainbeam("settled"));

    state = advanceAt(state, 5_000);

    expect(state.active.map((moment) => moment.moment.kind)).toEqual([
      "chainbeam",
    ]);
  });

  it("does not release non-protagonist moments and drops stale pending moments", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, {
      ...shockwave("other"),
      flightId: "UA200-20260615",
    });
    state = enqueueKeyMoment(state, shockwave("old", cycleStartedAt - 61_000));

    state = advanceAt(state, 5_000);

    expect(state.active).toHaveLength(0);
    expect(state.pending.map((moment) => moment.id)).toEqual([
      "other:shockwave",
    ]);
  });

  it("matches backend dated flight ids to a callsign protagonist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, shockwave("dated-backend-id"));

    vi.setSystemTime(cycleStartedAt + 5_000);
    state = advanceKeyMomentTimeline(state, {
      now: Date.now(),
      phase: "story",
      cycleStartedAt,
      protagonistFlightId: "BA178",
    });

    expect(state.active.map((active) => active.moment.id)).toEqual([
      "dated-backend-id:shockwave",
    ]);
    expect(state.pending).toHaveLength(0);
  });

  it("releases a pending non-protagonist moment if that flight becomes protagonist within the lookback window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, {
      ...shockwave("queued-real"),
      flightId: "UA200-20260615",
    });

    state = advanceAt(state, 5_000);
    expect(state.active).toHaveLength(0);
    expect(state.pending).toHaveLength(1);

    vi.setSystemTime(cycleStartedAt + 6_000);
    state = advanceKeyMomentTimeline(state, {
      now: Date.now(),
      phase: "story",
      cycleStartedAt,
      protagonistFlightId: "UA200-20260615",
    });

    expect(state.active.map((active) => active.moment.id)).toEqual([
      "queued-real:shockwave",
    ]);
    expect(state.pending).toHaveLength(0);
  });

  it("drops a pending non-protagonist moment if that flight becomes protagonist after the lookback window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    state = enqueueKeyMoment(state, {
      ...shockwave("too-old", cycleStartedAt),
      flightId: "UA200-20260615",
    });

    vi.setSystemTime(cycleStartedAt + 61_001);
    state = advanceKeyMomentTimeline(state, {
      now: Date.now(),
      phase: "story",
      cycleStartedAt,
      protagonistFlightId: "UA200-20260615",
    });

    expect(state.active).toHaveLength(0);
    expect(state.pending).toHaveLength(0);
  });

  it("caps active moments at the latest six entries during burst release", () => {
    vi.useFakeTimers();
    vi.setSystemTime(cycleStartedAt);

    let state = createKeyMomentTimelineState();
    for (let index = 0; index < 10; index += 1) {
      state = enqueueKeyMoment(state, shockwave(`trigger-${index}`));
    }

    state = advanceAt(state, 5_000);

    expect(state.active).toHaveLength(6);
    expect(state.active.map((active) => active.moment.id)).toEqual([
      "trigger-4:shockwave",
      "trigger-5:shockwave",
      "trigger-6:shockwave",
      "trigger-7:shockwave",
      "trigger-8:shockwave",
      "trigger-9:shockwave",
    ]);
  });
});
