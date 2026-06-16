import { useMemo } from "react";
import { matches } from "../components/search/searchMatch";
import { useFlights, type FlightPublic } from "./useFlights";

export interface SearchFlightResult extends FlightPublic {
  id: string;
  flight_id: string;
}

function todaySuffix(): string {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function withFlightId(flight: FlightPublic): SearchFlightResult {
  const id = `${flight.callsign.trim()}-${todaySuffix()}`;
  return { ...flight, id, flight_id: id };
}

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
    results: matchedFlights.slice(0, 10).map(withFlightId),
    totalMatches: matchedFlights.length,
    isLoading,
  };
}
