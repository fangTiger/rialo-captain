import { useMemo } from "react";
import { matches } from "../components/search/searchMatch";
import { useFlights } from "./useFlights";

export function useSearchFlights(query: string) {
  const { flights, isLoading } = useFlights();
  const normalizedQuery = query.trim();

  const matchedFlights = useMemo(() => {
    if (!normalizedQuery) return [];
    return flights
      .filter((flight) => matches(flight, normalizedQuery))
      .sort((a, b) => a.callsign.localeCompare(b.callsign));
  }, [flights, normalizedQuery]);

  return {
    results: matchedFlights.slice(0, 10),
    totalMatches: matchedFlights.length,
    isLoading,
  };
}
