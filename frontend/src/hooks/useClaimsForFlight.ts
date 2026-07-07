import useSWR from "swr";
import { useMemo } from "react";
import { apiFetch } from "../api/client";
import { mergeClaimsWithFlares, type Claim } from "./useClaims";
import { useEventStore } from "../store/eventStore";

const fetcher = (path: string) => apiFetch<Claim[]>(path);

export function useClaimsForFlight(flightId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Claim[]>(
    flightId ? `/claims/recent?flight_id=${flightId}` : null,
    fetcher,
  );
  const flares = useEventStore((state) => state.flares);
  const claims = useMemo(
    () => mergeClaimsWithFlares(data ?? [], flares, { flightId }),
    [data, flares, flightId],
  );

  return { claims, error, isLoading, refresh: mutate };
}
