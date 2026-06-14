import useSWR from "swr";
import { useEffect } from "react";
import { apiFetch } from "../api/client";
import { useEventStore } from "../store/eventStore";

export interface Policy {
  id: string;
  flight_id: string;
  premium: number;
  payout: number;
  status: "active" | "paid" | "expired";
  contract_ref: string;
  created_at: number;
}

const fetcher = (path: string) => apiFetch<Policy[]>(path);

export function usePolicies() {
  const { data, error, isLoading, mutate } = useSWR<Policy[]>(
    "/policies",
    fetcher,
  );
  const flareCount = useEventStore((state) => state.flares.length);

  useEffect(() => {
    if (flareCount > 0) mutate();
  }, [flareCount, mutate]);

  return { policies: data ?? [], error, isLoading, refresh: mutate };
}
