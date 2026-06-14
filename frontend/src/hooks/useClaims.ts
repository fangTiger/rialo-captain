import useSWR from "swr";
import { useMemo } from "react";
import { apiFetch } from "../api/client";
import { useEventStore } from "../store/eventStore";

export interface Claim {
  id: string;
  policy_id: string;
  payout: number;
  delay_minutes: number;
  signature: string;
  settled_at: number;
  settle_duration_ms: number;
}

const fetcher = (path: string) => apiFetch<Claim[]>(path);

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
    const persistentSigs = new Set(persistent.map((claim) => claim.signature));
    const fromFlares: Claim[] = flares
      .filter((flare) => !persistentSigs.has(flare.signature))
      .map((flare) => ({
        id: `optimistic-${flare.signature.slice(0, 16)}`,
        policy_id: flare.policy_id,
        payout: flare.payout,
        delay_minutes: flare.delay_minutes,
        signature: flare.signature,
        settled_at: Math.floor(Date.now() / 1000),
        settle_duration_ms: flare.settle_duration_ms,
      }));

    return [...fromFlares, ...persistent];
  }, [data, flares]);

  return { claims, isLoading, error };
}
