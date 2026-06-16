import useSWR from "swr";
import { apiFetch } from "../api/client";
import type { Claim } from "./useClaims";

const fetcher = (path: string) => apiFetch<Claim[]>(path);

export function useClaimsForFlight(flightId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<Claim[]>(
    flightId ? `/claims/recent?flight_id=${flightId}` : null,
    fetcher,
  );

  return { claims: data ?? [], error, isLoading, refresh: mutate };
}
