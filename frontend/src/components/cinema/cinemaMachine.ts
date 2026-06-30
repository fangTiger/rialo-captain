import type { RealProtagonistEvent } from "./protagonist";

export type CinemaMode = "cinema" | "interactive" | "paused-hidden" | "degraded";

export type CinemaPhase =
  | "establish"
  | "zoom-in"
  | "story"
  | "zoom-out"
  | "rest";

export interface CinemaProtagonist {
  kind: "DEMO" | "REAL" | "DEMO_OFFLINE";
  flightId: string;
  callsign: string;
  longitude: number;
  latitude: number;
  policyId?: string;
  name?: string;
}

export interface CameraTarget {
  longitude: number;
  latitude: number;
  zoom: number;
  durationMs: number;
  reason: "protagonist" | "global";
  safeAreaInsets?: {
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
}

export interface CinemaState {
  mode: CinemaMode;
  phase: CinemaPhase;
  cycleId: number;
  cycleStartedAt: number;
  manualStartedAt: number | null;
  manualRemainingMs: number;
  playbackLockedUntil: number | null;
  cyclePromotionLocked: boolean;
  protagonist: CinemaProtagonist | null;
  realQueue: RealProtagonistEvent[];
  cameraTarget: CameraTarget | null;
  kpiTickId: number;
  storyResetId: number;
  lastRealTakeoverAt: number | null;
  lastRealTakeoverEventAt: number | null;
  realInjectErrorUntil: number | null;
}

export const CINEMA_CYCLE_MS = 30_000;
export const CINEMA_TICK_MS = 250;
export const MANUAL_IDLE_MS = 30_000;
const REAL_EVENT_LOOKBACK_MS = 60_000;
const REAL_QUEUE_CAP = 3;
export const REAL_INJECT_ERROR_MS = 3_000;

interface RouteRealProtagonistOptions {
  playbackLockMs?: number;
}

export function phaseForElapsed(elapsedMs: number): CinemaPhase {
  if (elapsedMs < 6_000) return "establish";
  if (elapsedMs < 8_000) return "zoom-in";
  if (elapsedMs < 25_000) return "story";
  if (elapsedMs < 27_000) return "zoom-out";
  return "rest";
}

export function cameraTargetForPhase(): CameraTarget | null {
  return null;
}

export function advanceCinemaState(state: CinemaState, now: number): CinemaState {
  let baseState = clearExpiredPlaybackLock(
    clearExpiredRealInjectError(state, now),
    now,
  );

  if (baseState.mode === "interactive" && isPlaybackLocked(baseState, now)) {
    baseState = keepPlaybackLockedCinemaState(baseState);
  }

  if (baseState.mode === "interactive") {
    const manualStartedAt = baseState.manualStartedAt ?? now;
    const elapsed = Math.max(0, now - manualStartedAt);
    const manualRemainingMs = Math.max(0, MANUAL_IDLE_MS - elapsed);
    if (manualRemainingMs === 0) {
      return resumeCinemaState(baseState, now);
    }

    return {
      ...baseState,
      manualRemainingMs,
    };
  }

  if (baseState.mode !== "cinema") return baseState;

  const elapsedSinceStart = Math.max(0, now - baseState.cycleStartedAt);
  const completedCycles = Math.floor(elapsedSinceStart / CINEMA_CYCLE_MS);
  const cycleStartedAt =
    completedCycles > 0
      ? baseState.cycleStartedAt + completedCycles * CINEMA_CYCLE_MS
      : baseState.cycleStartedAt;
  const cycleElapsed = Math.max(0, now - cycleStartedAt);
  const phase = phaseForElapsed(cycleElapsed);

  let protagonist = baseState.protagonist;
  let realQueue = baseState.realQueue;
  if (
    completedCycles > 0 &&
    baseState.realQueue.length > 0 &&
    !baseState.cyclePromotionLocked
  ) {
    const [queuedReal, ...remainingRealQueue] = baseState.realQueue;
    protagonist = toRealProtagonist(queuedReal);
    realQueue = remainingRealQueue;
  }

  return {
    ...baseState,
    phase,
    cycleId: baseState.cycleId + completedCycles,
    cycleStartedAt,
    protagonist,
    realQueue,
    cameraTarget: null,
  };
}

export function createInitialCinemaState(
  now: number,
  protagonist: CinemaProtagonist | null = null,
  mode: CinemaMode = "cinema",
): CinemaState {
  return {
    mode,
    phase: "establish",
    cycleId: 1,
    cycleStartedAt: now,
    manualStartedAt: null,
    manualRemainingMs: 0,
    playbackLockedUntil: null,
    cyclePromotionLocked: false,
    protagonist,
    realQueue: [],
    cameraTarget: null,
    kpiTickId: 0,
    storyResetId: 0,
    lastRealTakeoverAt: null,
    lastRealTakeoverEventAt: null,
    realInjectErrorUntil: null,
  };
}

export function interruptCinemaState(state: CinemaState, now: number): CinemaState {
  if (isPlaybackLocked(state, now)) {
    return keepPlaybackLockedCinemaState(state);
  }

  if (state.mode === "interactive") {
    return {
      ...state,
      manualStartedAt: now,
      manualRemainingMs: MANUAL_IDLE_MS,
    };
  }

  return {
    ...state,
    mode: "interactive",
    manualStartedAt: now,
    manualRemainingMs: MANUAL_IDLE_MS,
    cameraTarget: null,
  };
}

export function resumeCinemaState(state: CinemaState, now: number): CinemaState {
  if (isPlaybackLocked(state, now)) {
    return keepPlaybackLockedCinemaState(state);
  }

  return {
    ...createInitialCinemaState(now, state.protagonist),
    cycleId: state.cycleId + 1,
    kpiTickId: state.kpiTickId,
    realQueue: state.realQueue,
    cyclePromotionLocked: state.cyclePromotionLocked,
    storyResetId: state.storyResetId,
    lastRealTakeoverAt: state.lastRealTakeoverAt,
    lastRealTakeoverEventAt: state.lastRealTakeoverEventAt,
    realInjectErrorUntil: state.realInjectErrorUntil,
  };
}

export function pauseHiddenCinemaState(state: CinemaState): CinemaState {
  return {
    ...state,
    mode: "paused-hidden",
    cameraTarget: null,
    manualRemainingMs: 0,
    manualStartedAt: null,
  };
}

export function setCyclePromotionLockedState(
  state: CinemaState,
  locked: boolean,
): CinemaState {
  if (state.cyclePromotionLocked === locked) return state;
  return {
    ...state,
    cyclePromotionLocked: locked,
  };
}

export function markKpiTickState(state: CinemaState): CinemaState {
  return {
    ...state,
    kpiTickId: state.kpiTickId + 1,
  };
}

export function markDemoOfflineState(
  state: CinemaState,
  protagonist: CinemaProtagonist,
): CinemaState {
  return {
    ...state,
    mode: state.mode === "cinema" ? "degraded" : state.mode,
    protagonist: {
      ...protagonist,
      kind: "DEMO_OFFLINE",
    },
    cameraTarget: null,
  };
}

export function markRealInjectFailedState(
  state: CinemaState,
  now: number,
): CinemaState {
  if (state.protagonist?.kind !== "REAL") return state;
  return {
    ...state,
    realInjectErrorUntil: now + REAL_INJECT_ERROR_MS,
  };
}

export function setDemoProtagonistState(
  state: CinemaState,
  protagonist: CinemaProtagonist,
): CinemaState {
  return {
    ...state,
    protagonist: {
      ...protagonist,
      kind: "DEMO",
    },
    cameraTarget: null,
  };
}

export function degradeDataLinkState(state: CinemaState): CinemaState {
  if (state.mode === "interactive") return state;
  return {
    ...state,
    mode: "degraded",
    cameraTarget: null,
  };
}

export function recoverDataLinkState(state: CinemaState, now: number): CinemaState {
  if (state.mode !== "degraded") return state;
  return resumeCinemaState(state, now);
}

function clearExpiredRealInjectError(
  state: CinemaState,
  now: number,
): CinemaState {
  if (
    state.realInjectErrorUntil === null ||
    now < state.realInjectErrorUntil
  ) {
    return state;
  }
  return {
    ...state,
    realInjectErrorUntil: null,
  };
}

function clearExpiredPlaybackLock(
  state: CinemaState,
  now: number,
): CinemaState {
  if (state.playbackLockedUntil === null || now < state.playbackLockedUntil) {
    return state;
  }
  return {
    ...state,
    playbackLockedUntil: null,
  };
}

function isPlaybackLocked(state: CinemaState, now: number) {
  return state.playbackLockedUntil !== null && now < state.playbackLockedUntil;
}

function keepPlaybackLockedCinemaState(state: CinemaState): CinemaState {
  return {
    ...state,
    mode: "cinema",
    manualStartedAt: null,
    manualRemainingMs: 0,
    cameraTarget: null,
  };
}

function toRealProtagonist(event: RealProtagonistEvent): CinemaProtagonist {
  return {
    kind: "REAL",
    flightId: event.flightId,
    callsign: event.callsign,
    longitude: event.longitude,
    latitude: event.latitude,
    policyId: event.policyId,
  };
}

function hasSeenRealEventPolicy(
  state: CinemaState,
  event: RealProtagonistEvent,
) {
  if (!event.policyId) return false;
  if (state.protagonist?.policyId === event.policyId) return true;
  return state.realQueue.some((queued) => queued.policyId === event.policyId);
}

export function routeRealProtagonistState(
  state: CinemaState,
  event: RealProtagonistEvent,
  now: number,
  options: RouteRealProtagonistOptions = {},
): CinemaState {
  if (now - event.createdAt > REAL_EVENT_LOOKBACK_MS) return state;
  if (hasSeenRealEventPolicy(state, event)) return state;

  const lastRealTakeoverEventAt = state.lastRealTakeoverEventAt;
  const isBurst =
    lastRealTakeoverEventAt !== null
      ? event.createdAt >= lastRealTakeoverEventAt &&
        event.createdAt - lastRealTakeoverEventAt < 1_000
      : state.lastRealTakeoverAt !== null &&
        now - state.lastRealTakeoverAt < 1_000;

  if (isBurst) {
    return {
      ...state,
      realQueue: [...state.realQueue, event].slice(-REAL_QUEUE_CAP),
    };
  }

  const protagonist = toRealProtagonist(event);
  return {
    ...state,
    mode: "cinema",
    phase: "establish",
    cycleStartedAt: now,
    manualStartedAt: null,
    manualRemainingMs: 0,
    playbackLockedUntil:
      options.playbackLockMs !== undefined ? now + options.playbackLockMs : null,
    protagonist,
    cameraTarget: null,
    storyResetId: state.storyResetId + 1,
    lastRealTakeoverAt: now,
    lastRealTakeoverEventAt: event.createdAt,
  };
}
