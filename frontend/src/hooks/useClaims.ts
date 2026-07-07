import useSWR from "swr";
import { useMemo } from "react";
import { apiFetch } from "../api/client";
import { useEventStore, type FlareEvent } from "../store/eventStore";

export interface Claim {
  id: string;
  policy_id: string;
  flight_id: string;
  payout: number;
  delay_minutes: number;
  signature: string;
  settled_at: number;
  settle_duration_ms: number;
}

const fetcher = (path: string) => apiFetch<Claim[]>(path);

function claimFromFlare(flare: FlareEvent): Claim {
  return {
    id: flare.claim_id ?? `optimistic-${flare.signature.slice(0, 16)}`,
    policy_id: flare.policy_id,
    flight_id: flare.flight_id,
    payout: flare.payout,
    delay_minutes: flare.delay_minutes,
    signature: flare.signature,
    settled_at: Math.floor(Date.now() / 1000),
    settle_duration_ms: flare.settle_duration_ms,
  };
}

export function mergeClaimsWithFlares(
  persistent: Claim[],
  flares: FlareEvent[],
  options: { flightId?: string } = {},
): Claim[] {
  const persistentSigs = new Set(persistent.map((claim) => claim.signature));
  const fromFlares = flares
    .filter((flare) => !options.flightId || flare.flight_id === options.flightId)
    .filter((flare) => !persistentSigs.has(flare.signature))
    .map(claimFromFlare);

  return [...fromFlares, ...persistent];
}

export function useClaims() {
  const { data, error, isLoading } = useSWR<Claim[]>(
    "/claims/recent?limit=50",
    fetcher,
    {
      refreshInterval: 30000,
    },
  );
  const flares = useEventStore((state) => state.flares);

  const claims = useMemo<Claim[]>(() => {
    const persistent = data ?? [];
    return mergeClaimsWithFlares(persistent, flares);
  }, [data, flares]);

  return { claims, isLoading, error };
}
