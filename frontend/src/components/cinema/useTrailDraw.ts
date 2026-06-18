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
import {
  estimateLivePosition,
  matchesFlightIdentity,
} from "./flightMotion";
import type { FlightPublic } from "../../hooks/useFlights";

export const TRAIL_DRAW_TTL_MS = 1_000;
export const TRAIL_DRAW_START_MS = 4_000;
const TRAIL_DRAW_END_MS = TRAIL_DRAW_START_MS + TRAIL_DRAW_TTL_MS;

export interface ActiveTrailDraw {
  id: string;
  flightId: string;
  startedAt: number;
  expiresAt: number;
  points: TrailCoordinate[];
}

type TrailFlight = Pick<
  FlightPublic,
  "callsign" | "heading" | "latitude" | "longitude" | "velocity"
>;

interface UseTrailDrawOptions {
  mode: CinemaMode;
  phase: CinemaPhase;
  cycleStartedAt: number;
  protagonist: CinemaProtagonist | null;
  flights?: TrailFlight[];
  userElectedFlight?: TrailFlight | null;
  userElectedTrailToken?: number;
  resetToken?: number;
  ttlMs?: number;
}

function callsignKey(value: string) {
  return value.trim().toUpperCase();
}

function findMatchingFlight(
  protagonist: CinemaProtagonist,
  flights: TrailFlight[],
) {
  const protagonistCallsign = callsignKey(protagonist.callsign);
  const protagonistFlightId = callsignKey(protagonist.flightId);
  return flights.find((flight) => {
    return (
      matchesFlightIdentity(flight.callsign, protagonistCallsign) ||
      matchesFlightIdentity(flight.callsign, protagonistFlightId)
    );
  });
}

function hasValidProtagonistPosition(protagonist: CinemaProtagonist) {
  return (
    Number.isFinite(protagonist.longitude) &&
    Number.isFinite(protagonist.latitude)
  );
}

function trailFlightSignature(flight: TrailFlight) {
  return [
    callsignKey(flight.callsign),
    flight.longitude,
    flight.latitude,
    flight.heading ?? "none",
    flight.velocity ?? "none",
  ].join("|");
}

function protagonistTriggerKey(protagonist: CinemaProtagonist | null) {
  if (!protagonist) return null;
  return [
    callsignKey(protagonist.flightId),
    callsignKey(protagonist.callsign),
  ].join(":");
}

function trailGateStartForProtagonist(
  cycleStartedAt: number,
  protagonistReadyAt: number | null,
) {
  if (protagonistReadyAt === null) return cycleStartedAt;
  return protagonistReadyAt <= cycleStartedAt + TRAIL_DRAW_END_MS
    ? cycleStartedAt
    : protagonistReadyAt;
}

export function useTrailDraw({
  mode,
  phase,
  cycleStartedAt,
  protagonist,
  flights = [],
  userElectedFlight = null,
  userElectedTrailToken = 0,
  resetToken = 0,
  ttlMs = TRAIL_DRAW_TTL_MS,
}: UseTrailDrawOptions) {
  const [activeTrail, setActiveTrail] = useState<ActiveTrailDraw | null>(null);
  const triggeredKeysRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);
  const startTimeoutRef = useRef<number | null>(null);
  const flightSnapshotAtRef = useRef(Date.now());
  const electedSignatureRef = useRef<string | null>(null);
  const electedVersionRef = useRef(0);
  const protagonistKeyRef = useRef<string | null>(protagonistTriggerKey(protagonist));
  const protagonistReadyAtRef = useRef<number | null>(
    protagonist ? cycleStartedAt : null,
  );

  useEffect(() => {
    flightSnapshotAtRef.current = Date.now();
  }, [flights]);

  useEffect(() => {
    const key = protagonistTriggerKey(protagonist);
    if (protagonistKeyRef.current === key) return;
    protagonistKeyRef.current = key;
    protagonistReadyAtRef.current = key ? Date.now() : null;
  }, [protagonist?.callsign, protagonist?.flightId]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (startTimeoutRef.current !== null) {
        window.clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setActiveTrail(null);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  }, [resetToken]);

  useEffect(() => {
    if (startTimeoutRef.current !== null) {
      window.clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    if (userElectedFlight) {
      const signature = [
        trailFlightSignature(userElectedFlight),
        userElectedTrailToken,
      ].join("|");
      if (electedSignatureRef.current !== signature) {
        electedSignatureRef.current = signature;
        electedVersionRef.current += 1;
        setActiveTrail(null);
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }

      const triggerKey = `elected:${callsignKey(userElectedFlight.callsign)}:${electedVersionRef.current}`;
      if (triggeredKeysRef.current.has(triggerKey)) return;

      const livePosition = estimateLivePosition(
        userElectedFlight,
        (Date.now() - flightSnapshotAtRef.current) / 1000,
      );
      const points = buildTrailPoints({
        longitude: livePosition?.longitude ?? userElectedFlight.longitude,
        latitude: livePosition?.latitude ?? userElectedFlight.latitude,
        heading: userElectedFlight.heading,
        velocity: userElectedFlight.velocity,
      });
      if (!points) return;

      triggeredKeysRef.current.add(triggerKey);

      const now = Date.now();
      const trail: ActiveTrailDraw = {
        id: `${triggerKey}:traildraw`,
        flightId: userElectedFlight.callsign,
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
      return;
    }

    if (electedSignatureRef.current !== null) {
      electedSignatureRef.current = null;
      setActiveTrail((current) =>
        current?.id.startsWith("elected:") ? null : current,
      );
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    if (
      mode !== "cinema" ||
      (phase !== "establish" && phase !== "zoom-in" && phase !== "story") ||
      !protagonist ||
      !hasValidProtagonistPosition(protagonist)
    ) {
      return;
    }

    const triggerKey = `${cycleStartedAt}:${protagonist.flightId}`;
    if (triggeredKeysRef.current.has(triggerKey)) return;
    const trailGateStartedAt = trailGateStartForProtagonist(
      cycleStartedAt,
      protagonistReadyAtRef.current,
    );

    const activateTrail = () => {
      const elapsedMs = Date.now() - trailGateStartedAt;
      if (elapsedMs < TRAIL_DRAW_START_MS || elapsedMs >= TRAIL_DRAW_END_MS) {
        return;
      }

      const matchingFlight = findMatchingFlight(protagonist, flights);
      const livePosition = matchingFlight
        ? estimateLivePosition(
            matchingFlight,
            (Date.now() - flightSnapshotAtRef.current) / 1000,
          )
        : null;
      const trailEndpoint = livePosition ?? {
        longitude: protagonist.longitude,
        latitude: protagonist.latitude,
      };
      const points = buildTrailPoints({
        longitude: trailEndpoint.longitude,
        latitude: trailEndpoint.latitude,
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
    };

    const elapsedMs = Date.now() - trailGateStartedAt;
    if (elapsedMs >= TRAIL_DRAW_END_MS) return;
    if (elapsedMs >= TRAIL_DRAW_START_MS) {
      activateTrail();
      return;
    }

    startTimeoutRef.current = window.setTimeout(() => {
      startTimeoutRef.current = null;
      activateTrail();
    }, TRAIL_DRAW_START_MS - elapsedMs);
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
    userElectedFlight?.callsign,
    userElectedFlight?.heading,
    userElectedFlight?.latitude,
    userElectedFlight?.longitude,
    userElectedFlight?.velocity,
    userElectedTrailToken,
  ]);

  return { activeTrail };
}
