import { useEffect, useRef, useState } from "react";

import type {
  CinemaMode,
  CinemaPhase,
  CinemaProtagonist,
} from "./CinemaContext";
import {
  buildTrailPoints,
  type TrailCoordinate,
} from "./trailGeometry";
import type { FlightPublic } from "../../hooks/useFlights";

export const TRAIL_DRAW_TTL_MS = 3_000;

export interface ActiveTrailDraw {
  id: string;
  flightId: string;
  startedAt: number;
  expiresAt: number;
  points: TrailCoordinate[];
}

interface UseTrailDrawOptions {
  mode: CinemaMode;
  phase: CinemaPhase;
  cycleStartedAt: number;
  protagonist: CinemaProtagonist | null;
  flights?: Pick<FlightPublic, "callsign" | "heading" | "velocity">[];
  resetToken?: number;
  ttlMs?: number;
}

function callsignKey(value: string) {
  return value.trim().toUpperCase();
}

function findMatchingFlight(
  protagonist: CinemaProtagonist,
  flights: Pick<FlightPublic, "callsign" | "heading" | "velocity">[],
) {
  const protagonistCallsign = callsignKey(protagonist.callsign);
  const protagonistFlightId = callsignKey(protagonist.flightId);
  return flights.find((flight) => {
    const flightCallsign = callsignKey(flight.callsign);
    return (
      flightCallsign === protagonistCallsign ||
      flightCallsign === protagonistFlightId
    );
  });
}

export function useTrailDraw({
  mode,
  phase,
  cycleStartedAt,
  protagonist,
  flights = [],
  resetToken = 0,
  ttlMs = TRAIL_DRAW_TTL_MS,
}: UseTrailDrawOptions) {
  const [activeTrail, setActiveTrail] = useState<ActiveTrailDraw | null>(null);
  const triggeredKeysRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setActiveTrail(null);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [resetToken]);

  useEffect(() => {
    if (mode !== "cinema" || phase !== "story" || !protagonist) return;

    const triggerKey = `${cycleStartedAt}:${protagonist.flightId}`;
    if (triggeredKeysRef.current.has(triggerKey)) return;

    const matchingFlight = findMatchingFlight(protagonist, flights);
    const points = buildTrailPoints({
      longitude: protagonist.longitude,
      latitude: protagonist.latitude,
      heading: matchingFlight?.heading,
      velocity: matchingFlight?.velocity,
    });
    if (!points) return;

    triggeredKeysRef.current.add(triggerKey);

    const now = Date.now();
    const trail: ActiveTrailDraw = {
      id: `${triggerKey}:traildraw`,
      flightId: protagonist.flightId,
      startedAt: now,
      expiresAt: now + ttlMs,
      points,
    };

    setActiveTrail(trail);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setActiveTrail((current) => (current?.id === trail.id ? null : current));
      timeoutRef.current = null;
    }, ttlMs);
  }, [
    cycleStartedAt,
    flights,
    mode,
    phase,
    protagonist?.callsign,
    protagonist?.flightId,
    protagonist?.latitude,
    protagonist?.longitude,
    ttlMs,
  ]);

  return { activeTrail };
}
