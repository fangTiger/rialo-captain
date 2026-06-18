import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceKeyMomentTimeline,
  createKeyMomentTimelineState,
  enqueueKeyMoment,
  resetKeyMomentTimelineForProtagonist,
  type KeyMomentResetTarget,
  type KeyMomentTimelineState,
} from "./keyMomentTimeline";
import type { CinemaPhase } from "./cinemaMachine";
import type { KeyMoment } from "./keyMoments";

const TIMELINE_TICK_MS = 100;

interface UseKeyMomentQueueContext {
  phase: CinemaPhase;
  cycleStartedAt: number;
  protagonistFlightId: string | null;
}

function shouldAdvance(state: KeyMomentTimelineState) {
  return state.pending.length > 0 || state.active.length > 0;
}

export function useKeyMomentQueue(context: UseKeyMomentQueueContext) {
  const contextRef = useRef(context);
  const intervalRef = useRef<number | null>(null);
  const releaseTimerRef = useRef<number | null>(null);
  const [timelineState, setTimelineState] = useState<KeyMomentTimelineState>(
    createKeyMomentTimelineState,
  );
  contextRef.current = context;

  const advance = useCallback((state: KeyMomentTimelineState) => {
    if (!shouldAdvance(state)) return state;
    const latestContext = contextRef.current;
    return advanceKeyMomentTimeline(state, {
      now: Date.now(),
      phase: latestContext.phase,
      cycleStartedAt: latestContext.cycleStartedAt,
      protagonistFlightId: latestContext.protagonistFlightId,
    });
  }, []);

  const enqueue = useCallback((moment: KeyMoment) => {
    setTimelineState((current) => enqueueKeyMoment(current, moment));
    if (releaseTimerRef.current !== null) return;
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null;
      setTimelineState((current) => advance(current));
    }, 0);
  }, [advance]);

  const clearAllMoments = useCallback(() => {
    setTimelineState(createKeyMomentTimelineState());
  }, []);

  const resetForProtagonist = useCallback((target: KeyMomentResetTarget) => {
    setTimelineState((current) =>
      resetKeyMomentTimelineForProtagonist(current, target),
    );
  }, []);

  useEffect(() => {
    setTimelineState((current) => advance(current));
  }, [
    advance,
    context.cycleStartedAt,
    context.phase,
    context.protagonistFlightId,
  ]);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setTimelineState((current) => advance(current));
    }, TIMELINE_TICK_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };
  }, [advance]);

  return {
    activeMoments: timelineState.active,
    clearAllMoments,
    enqueue,
    resetForProtagonist,
  };
}
