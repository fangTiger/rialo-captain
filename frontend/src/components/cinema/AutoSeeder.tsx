import { useEffect, useRef } from "react";
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
}

export function AutoSeeder({
  flights,
  userEmail = "captain@local.dev",
  delayMinutes = 45,
}: AutoSeederProps) {
  const cinema = useCinema();
  const seededByCycleRef = useRef<Set<number>>(new Set());
  const injectedByCycleRef = useRef<Set<number>>(new Set());
  const seedResultByCycleRef = useRef<Map<number, SeedDemoResponse>>(new Map());

  useEffect(() => {
    if (cinema.mode !== "cinema" || cinema.phase !== "establish") return;
    if (seededByCycleRef.current.has(cinema.cycleId)) return;

    const protagonist = chooseDemoProtagonist(flights, cinema.cycleId - 1);
    if (!protagonist) return;

    seededByCycleRef.current.add(cinema.cycleId);
    void apiFetch<SeedDemoResponse>("/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        user_email: userEmail,
        protagonist_name: protagonist.name,
      }),
    }).then((result) => {
      seedResultByCycleRef.current.set(cinema.cycleId, result);
    }).catch(() => {
      cinema.markDemoOffline(protagonist);
    });
  }, [cinema.cycleId, cinema.mode, cinema.phase, flights, userEmail]);

  useEffect(() => {
    if (cinema.mode !== "cinema") return;
    if (injectedByCycleRef.current.has(cinema.cycleId)) return;

    const elapsedMs = Date.now() - cinema.cycleStartedAt;
    if (elapsedMs < 12_000) return;

    const seedResult = seedResultByCycleRef.current.get(cinema.cycleId);
    if (!seedResult) return;

    injectedByCycleRef.current.add(cinema.cycleId);
    void apiFetch<InjectDelayResponse>("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: seedResult.flight_id,
        delay_minutes: delayMinutes,
      }),
    });
  }, [
    cinema.cycleId,
    cinema.cycleStartedAt,
    cinema.mode,
    cinema.phase,
    delayMinutes,
  ]);

  return null;
}
