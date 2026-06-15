import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CinemaEvent } from "../../store/eventStore";
import {
  capHeatPoints,
  heatPointFromPolicyEvent,
  HEATMAP_LOOKBACK_MS,
  pruneHeatPoints,
  selectHeatmapFocusPoints,
  type HeatPoint,
} from "./ambientHeatmap";

export function useAmbientHeatmap() {
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const [points, setPoints] = useState<HeatPoint[]>([]);

  const addPolicyEvent = useCallback((event: CinemaEvent) => {
    setPoints((current) => {
      const point = heatPointFromPolicyEvent(event, seenEventIdsRef.current);
      if (!point) return current;

      seenEventIdsRef.current.add(event.id);
      return capHeatPoints(pruneHeatPoints([...current, point], Date.now()));
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPoints((current) => pruneHeatPoints(current, Date.now()));
    }, HEATMAP_LOOKBACK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const focusPoints = useMemo(() => selectHeatmapFocusPoints(points), [points]);

  return {
    addPolicyEvent,
    focusPoints,
    points,
  };
}
