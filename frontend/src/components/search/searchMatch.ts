import type { FlightPublic } from "../../hooks/useFlights";

export function matches(flight: FlightPublic, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const origin = flight.origin ?? "";
  const destination = flight.destination ?? "";
  const haystack = [
    flight.callsign,
    origin,
    destination,
    `${origin}->${destination}`,
    `${origin}→${destination}`,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}
