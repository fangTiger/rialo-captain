import useSWR from "swr";
import { apiFetch } from "../api/client";

export interface HotRoute {
  callsign: string;
  flight_id: string;
  policy_count: number;
  delay_rate: number;
  samples: number;
}

const fetcher = (path: string) => apiFetch<HotRoute[]>(path);

export function useHotRoutes() {
  const { data, isLoading } = useSWR<HotRoute[]>(
    "/routes/hot?limit=30",
    fetcher,
  );
  return { routes: data ?? [], isLoading };
}
