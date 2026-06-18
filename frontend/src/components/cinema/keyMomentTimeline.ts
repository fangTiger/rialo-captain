import type { CinemaPhase } from "./cinemaMachine";
import type { KeyMoment } from "./keyMoments";

const STORY_TRIGGER_AT_MS = 6_000;
const CHAIN_AFTER_SHOCKWAVE_MS = 2_000;
const FLARE_AFTER_CHAIN_MS = 2_000;
const PENDING_LOOKBACK_MS = 60_000;
const ACTIVE_CAP = 6;

export const KEY_MOMENT_TTL_MS = {
  shockwave: 2_000,
  chainbeam: 4_000,
  flareland: 2_000,
} as const;

export interface ActiveKeyMoment {
  moment: KeyMoment;
  startedAt: number;
  expiresAt: number;
}

export interface KeyMomentTimelineState {
  pending: KeyMoment[];
  active: ActiveKeyMoment[];
  playedIds: string[];
  shockwaveStartedByPolicy: Record<string, number>;
  chainbeamStartedByPolicy: Record<string, number>;
}

export interface KeyMomentResetTarget {
  flightId: string | null;
  policyId?: string;
}

export interface AdvanceKeyMomentTimelineContext {
  now: number;
  phase: CinemaPhase;
  cycleStartedAt: number;
  protagonistFlightId: string | null;
}

export function createKeyMomentTimelineState(): KeyMomentTimelineState {
  return {
    pending: [],
    active: [],
    playedIds: [],
    shockwaveStartedByPolicy: {},
    chainbeamStartedByPolicy: {},
  };
}

export function enqueueKeyMoment(
  state: KeyMomentTimelineState,
  moment: KeyMoment,
): KeyMomentTimelineState {
  if (
    state.pending.some((pending) => pending.id === moment.id) ||
    state.playedIds.includes(moment.id)
  ) {
    return state;
  }

  return {
    ...state,
    pending: [...state.pending, moment],
  };
}

export function resetKeyMomentTimelineForProtagonist(
  state: KeyMomentTimelineState,
  target: KeyMomentResetTarget,
): KeyMomentTimelineState {
  const resetState = createKeyMomentTimelineState();
  if (!target.flightId) return resetState;

  const matchingMoments = [
    ...state.pending,
    ...state.active.map((activeMoment) => activeMoment.moment),
  ].filter((moment) => matchesResetTarget(moment, target));
  const seenMomentIds = new Set<string>();

  return {
    ...resetState,
    pending: matchingMoments.filter((moment) => {
      if (seenMomentIds.has(moment.id)) return false;
      seenMomentIds.add(moment.id);
      return true;
    }),
  };
}

export function advanceKeyMomentTimeline(
  state: KeyMomentTimelineState,
  context: AdvanceKeyMomentTimelineContext,
): KeyMomentTimelineState {
  const played = new Set(state.playedIds);
  const shockwaveStartedByPolicy = { ...state.shockwaveStartedByPolicy };
  const chainbeamStartedByPolicy = { ...state.chainbeamStartedByPolicy };
  const active = state.active.filter((moment) => moment.expiresAt > context.now);
  const nextPending: KeyMoment[] = [];
  const released: ActiveKeyMoment[] = [];

  for (const moment of state.pending) {
    if (played.has(moment.id)) continue;
    if (context.now - moment.receivedAt > PENDING_LOOKBACK_MS) continue;

    if (!matchesProtagonistFlight(moment.flightId, context.protagonistFlightId)) {
      nextPending.push(moment);
      continue;
    }

    if (
      canReleaseMoment(
        moment,
        context,
        shockwaveStartedByPolicy,
        chainbeamStartedByPolicy,
        state.pending,
      )
    ) {
      played.add(moment.id);
      const activeMoment = {
        moment,
        startedAt: context.now,
        expiresAt: context.now + KEY_MOMENT_TTL_MS[moment.kind],
      };
      released.push(activeMoment);

      if (moment.kind === "shockwave") {
        shockwaveStartedByPolicy[moment.policyId] = context.now;
      }
      if (moment.kind === "chainbeam") {
        chainbeamStartedByPolicy[moment.policyId] = context.now;
      }
    } else {
      nextPending.push(moment);
    }
  }

  return {
    pending: nextPending,
    active: [...active, ...released].slice(-ACTIVE_CAP),
    playedIds: Array.from(played),
    shockwaveStartedByPolicy,
    chainbeamStartedByPolicy,
  };
}

function flightMatchKeys(flightId: string) {
  const normalized = flightId.trim().toUpperCase();
  const datedFlight = normalized.match(/^(.+)-\d{8}$/);
  return datedFlight ? [normalized, datedFlight[1]] : [normalized];
}

function matchesProtagonistFlight(
  momentFlightId: string,
  protagonistFlightId: string | null,
) {
  if (!protagonistFlightId) return false;

  const momentKeys = flightMatchKeys(momentFlightId);
  const protagonistKeys = new Set(flightMatchKeys(protagonistFlightId));
  return momentKeys.some((key) => protagonistKeys.has(key));
}

function matchesResetTarget(moment: KeyMoment, target: KeyMomentResetTarget) {
  if (target.policyId) return moment.policyId === target.policyId;
  return matchesProtagonistFlight(moment.flightId, target.flightId);
}

function canReleaseMoment(
  moment: KeyMoment,
  context: AdvanceKeyMomentTimelineContext,
  shockwaveStartedByPolicy: Record<string, number>,
  chainbeamStartedByPolicy: Record<string, number>,
  pending: KeyMoment[],
) {
  if (context.phase !== "zoom-in" && context.phase !== "story") return false;

  const cycleElapsed = context.now - context.cycleStartedAt;
  if (cycleElapsed < STORY_TRIGGER_AT_MS) return false;

  if (moment.kind === "shockwave") return true;

  if (moment.kind === "chainbeam") {
    const shockwaveStartedAt = shockwaveStartedByPolicy[moment.policyId];
    if (shockwaveStartedAt === undefined) {
      return !pending.some(
        (pendingMoment) =>
          pendingMoment.kind === "shockwave" &&
          pendingMoment.policyId === moment.policyId,
      );
    }
    return context.now - shockwaveStartedAt >= CHAIN_AFTER_SHOCKWAVE_MS;
  }

  const chainbeamStartedAt = chainbeamStartedByPolicy[moment.policyId];
  if (chainbeamStartedAt === undefined) {
    return !pending.some(
      (pendingMoment) =>
        pendingMoment.kind === "chainbeam" &&
        pendingMoment.policyId === moment.policyId,
    );
  }
  return context.now - chainbeamStartedAt >= FLARE_AFTER_CHAIN_MS;
}
