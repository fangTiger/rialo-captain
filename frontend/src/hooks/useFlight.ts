import useSWR from "swr";
import { apiFetch } from "../api/client";

export interface FlightDetailDto {
  id: string;
  callsign: string;
  origin: string;
  destination: string;
  delay_rate: number;
  samples: number;
  live_delay_minutes: number | null;
}

const fetcher = (path: string) => apiFetch<FlightDetailDto>(path);

export function useFlight(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR<FlightDetailDto>(
    id ? `/flights/${id}` : null,
    fetcher,
  );

  return { flight: data ?? null, error, isLoading, refresh: mutate };
}
