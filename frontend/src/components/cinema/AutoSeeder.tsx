import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../../api/client";
import { useCinema } from "./CinemaContext";
import {
  chooseDemoProtagonist,
  type DemoFlightCandidate,
} from "./protagonist";

interface SeedDemoResponse {
  protagonist_name: string;
  flight_id: string;
  policy_ids: string[];
  policies_created: number;
  claims_settled: number;
}

interface InjectDelayResponse {
  flight_id: string;
  delay_minutes: number;
}

interface AutoSeederProps {
  flights: DemoFlightCandidate[];
  userEmail?: string;
  delayMinutes?: number;
  demoSelectionOffset?: number;
}

const DEMO_INJECT_AT_MS = 3_000;

function flightMatchKeys(flightId: string) {
  const normalized = flightId.trim().toUpperCase();
  const datedFlight = normalized.match(/^(.+)-\d{8}$/);
  return datedFlight ? [normalized, datedFlight[1]] : [normalized];
}

function matchesFlight(a: string, b: string) {
  const aKeys = flightMatchKeys(a);
  const bKeys = new Set(flightMatchKeys(b));
  return aKeys.some((key) => bKeys.has(key));
}

function seedMatchesProtagonist(
  seedFlightId: string,
  protagonist: NonNullable<ReturnType<typeof useCinema>["protagonist"]>,
) {
  return (
    matchesFlight(seedFlightId, protagonist.flightId) ||
    matchesFlight(seedFlightId, protagonist.callsign)
  );
}

export function AutoSeeder({
  flights,
  userEmail = "captain@local.dev",
  delayMinutes = 45,
  demoSelectionOffset = 0,
}: AutoSeederProps) {
  const {
    cycleId,
    cycleStartedAt,
    markDemoOffline,
    markRealInjectFailed,
    mode,
    phase,
    protagonist,
    realQueue,
    setDemoProtagonist,
  } = useCinema();
  const seededByCycleRef = useRef<Set<number>>(new Set());
  const injectedByCycleRef = useRef<Set<number>>(new Set());
  const realInjectedRef = useRef<Set<string>>(new Set());
  const seedResultByCycleRef = useRef<Map<number, SeedDemoResponse>>(new Map());
  const [seedReadyTick, setSeedReadyTick] = useState(0);

  useEffect(() => {
    if (mode !== "cinema" || phase !== "establish") return;
    if (seededByCycleRef.current.has(cycleId)) return;
    if (protagonist?.kind === "REAL" || realQueue.length > 0) return;

    const selectedProtagonist = chooseDemoProtagonist(
      flights,
      demoSelectionOffset + cycleId - 1,
    );
    if (!selectedProtagonist) return;

    seededByCycleRef.current.add(cycleId);
    setDemoProtagonist(selectedProtagonist);
    void apiFetch<SeedDemoResponse>("/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        user_email: userEmail,
        protagonist_name: selectedProtagonist.name,
        flight_id: selectedProtagonist.flightId,
      }),
    }).then((result) => {
      seedResultByCycleRef.current.set(cycleId, result);
      setSeedReadyTick((current) => current + 1);
    }).catch(() => {
      markDemoOffline(selectedProtagonist);
    });
  }, [
    cycleId,
    demoSelectionOffset,
    flights,
    markDemoOffline,
    mode,
    phase,
    protagonist?.kind,
    realQueue.length,
    setDemoProtagonist,
    userEmail,
  ]);

  useEffect(() => {
    if (mode !== "cinema") return;
    if (protagonist?.kind !== "REAL") return;

    const key = [
      cycleId,
      protagonist.flightId,
      protagonist.policyId ?? protagonist.flightId,
    ].join(":");
    if (realInjectedRef.current.has(key)) return;
    realInjectedRef.current.add(key);

    void apiFetch<InjectDelayResponse>("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: protagonist.flightId,
        delay_minutes: delayMinutes,
      }),
    }).catch(() => {
      markRealInjectFailed();
    });
  }, [
    cycleId,
    delayMinutes,
    markRealInjectFailed,
    mode,
    protagonist?.flightId,
    protagonist?.kind,
    protagonist?.policyId,
  ]);

  useEffect(() => {
    if (mode !== "cinema") return;
    if (protagonist?.kind !== "DEMO") return;
    if (realQueue.length > 0) return;
    if (injectedByCycleRef.current.has(cycleId)) return;

    const injectDemoDelay = () => {
      if (injectedByCycleRef.current.has(cycleId)) return;
      const seedResult = seedResultByCycleRef.current.get(cycleId);
      if (!seedResult) return;
      if (protagonist.kind !== "DEMO") return;
      if (!seedMatchesProtagonist(seedResult.flight_id, protagonist)) return;

      injectedByCycleRef.current.add(cycleId);
      void apiFetch<InjectDelayResponse>("/inject-delay", {
        method: "POST",
        body: JSON.stringify({
          flight_id: seedResult.flight_id,
          delay_minutes: delayMinutes,
        }),
      });
    };

    const elapsedMs = Date.now() - cycleStartedAt;
    const remainingMs = DEMO_INJECT_AT_MS - elapsedMs;
    if (remainingMs <= 0) {
      injectDemoDelay();
      return;
    }

    const id = window.setTimeout(injectDemoDelay, remainingMs);
    return () => window.clearTimeout(id);
  }, [
    cycleId,
    cycleStartedAt,
    mode,
    delayMinutes,
    protagonist?.callsign,
    protagonist?.flightId,
    protagonist?.kind,
    realQueue.length,
    seedReadyTick,
  ]);

  return null;
}
