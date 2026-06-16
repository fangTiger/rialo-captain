import useSWR from "swr";
import { apiFetch } from "../api/client";

export interface FlightPublic {
  icao24: string;
  callsign: string;
  origin_country: string;
  longitude: number | null;
  latitude: number | null;
  velocity: number | null;
  heading: number | null;
  on_ground: boolean;
  origin?: string | null;
  destination?: string | null;
  delay_rate?: number | null;
}

export interface LiveResponse {
  data_stale: boolean;
  stale_seconds: number;
  flights: FlightPublic[];
}

const fetcher = (path: string) => apiFetch<LiveResponse>(path);

export function useFlights() {
  const { data, error, isLoading } = useSWR<LiveResponse>(
    "/flights/live",
    fetcher,
    {
      refreshInterval: 15000,
    },
  );

  return {
    flights: data?.flights ?? [],
    stale: data?.data_stale ?? true,
    staleSeconds: data?.stale_seconds ?? 0,
    error,
    isLoading,
  };
}
