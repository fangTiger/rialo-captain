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

const TIMELINE_TICK_MS = 250;

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
    setTimelineState((current) =>
      advance(enqueueKeyMoment(current, moment)),
    );
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
    };
  }, [advance]);

  return {
    activeMoments: timelineState.active,
    clearAllMoments,
    enqueue,
    resetForProtagonist,
  };
}
