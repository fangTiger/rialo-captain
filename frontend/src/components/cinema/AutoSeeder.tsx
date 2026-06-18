import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../../api/client";
import { useEventStore, type FlareEvent } from "../../store/eventStore";
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
const FALLBACK_TRIGGER_AT_MS = 5_000;
const FALLBACK_SETTLED_AT_MS = 7_000;
const FALLBACK_LANDED_AT_MS = 9_000;
const FALLBACK_DEMO_PAYOUT = 320;
const FALLBACK_DEMO_SETTLE_DURATION_MS = 1_400;

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

function fallbackSignature(policyId: string) {
  const material = Array.from(policyId)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${material.padEnd(64, "0").slice(0, 64)}`;
}

function fallbackTxHash(policyId: string) {
  const material = Array.from(`tx:${policyId}`)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
  return `0x${material.padEnd(40, "0").slice(0, 40)}`;
}

function synthesizeDemoClosedLoopEvents(
  seedResult: SeedDemoResponse,
  delayMinutes: number,
  cycleStartedAt: number,
) {
  if (useEventStore.getState().wsState === "open") return [];

  const policyId = seedResult.policy_ids[0];
  if (!policyId || !seedResult.flight_id) return [];

  const signature = fallbackSignature(policyId);
  const flare: FlareEvent = {
    flight_id: seedResult.flight_id,
    policy_id: policyId,
    payout: FALLBACK_DEMO_PAYOUT,
    delay_minutes: delayMinutes,
    signature,
    settle_duration_ms: FALLBACK_DEMO_SETTLE_DURATION_MS,
  };

  const schedule = (targetMs: number, callback: () => void) => {
    const elapsedMs = Date.now() - cycleStartedAt;
    return window.setTimeout(() => {
      if (useEventStore.getState().wsState === "open") return;
      callback();
    }, Math.max(0, targetMs - elapsedMs));
  };

  return [
    schedule(FALLBACK_TRIGGER_AT_MS, () => {
      const now = Date.now();
      useEventStore.getState().addEvent({
        id: `demo-fallback:${policyId}:claim-triggered`,
        type: "claim.triggered",
        payload: {
          flight_id: seedResult.flight_id,
          policy_id: policyId,
          delay_minutes: delayMinutes,
          source: "admin-injection",
          airport_iata: "UNKNOWN",
        },
        receivedAt: now,
      });
    }),
    schedule(FALLBACK_SETTLED_AT_MS, () => {
      const now = Date.now();
      const store = useEventStore.getState();
      store.addEvent({
        id: `demo-fallback:${policyId}:claim-settled`,
        type: "claim.settled",
        payload: {
          ...flare,
          tx_hash: fallbackTxHash(policyId),
          block_height: 9001,
          source: "mock",
        },
        receivedAt: now,
      });
      store.addFlare(flare);
      store.addEvent({
        id: `demo-fallback:${policyId}:flare`,
        type: "flare",
        payload: { ...flare },
        receivedAt: now,
      });
    }),
    schedule(FALLBACK_LANDED_AT_MS, () => {
      const now = Date.now();
      useEventStore.getState().addEvent({
        id: `demo-fallback:${policyId}:flight-landed`,
        type: "flight.landed",
        payload: {
          flight_id: seedResult.flight_id,
          policy_id: policyId,
          landed_at: now,
          source: "mock",
        },
        receivedAt: now,
      });
    }),
  ];
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
  const fallbackTimerRefs = useRef<number[]>([]);
  const [seedReadyTick, setSeedReadyTick] = useState(0);
  const clearFallbackTimers = useCallback(() => {
    for (const timerId of fallbackTimerRefs.current) {
      window.clearTimeout(timerId);
    }
    fallbackTimerRefs.current = [];
  }, []);

  useEffect(() => {
    return () => clearFallbackTimers();
  }, [clearFallbackTimers]);

  useEffect(() => {
    clearFallbackTimers();
  }, [clearFallbackTimers, cycleId, protagonist?.flightId, protagonist?.kind]);

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
      }).then((result) => {
        clearFallbackTimers();
        fallbackTimerRefs.current = synthesizeDemoClosedLoopEvents(
          seedResult,
          result.delay_minutes,
          cycleStartedAt,
        );
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
    clearFallbackTimers,
    cycleId,
    cycleStartedAt,
    mode,
    delayMinutes,
    protagonist,
    realQueue.length,
    seedReadyTick,
  ]);

  return null;
}
