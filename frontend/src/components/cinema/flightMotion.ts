export const FLIGHT_TIME_ACCEL = 10;

export interface FlightMotionSource {
  callsign?: string | null;
  longitude: number | null | undefined;
  latitude: number | null | undefined;
  velocity?: number | null;
  heading?: number | null;
}

export interface FlightPosition {
  longitude: number;
  latitude: number;
}

function normalizeFlightKey(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
}

function flightIdentityKeys(value: string | null | undefined) {
  const normalized = normalizeFlightKey(value);
  if (!normalized) return [];

  const datedFlight = normalized.match(/^(.+)-\d{8}$/);
  return datedFlight ? [normalized, datedFlight[1]] : [normalized];
}

export function matchesFlightIdentity(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const leftKeys = flightIdentityKeys(left);
  const rightKeys = new Set(flightIdentityKeys(right));
  return leftKeys.some((key) => rightKeys.has(key));
}

function validPosition(source: FlightMotionSource): FlightPosition | null {
  const { longitude, latitude } = source;
  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return { longitude, latitude };
}

function validMotionValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function estimateLivePosition(
  source: FlightMotionSource,
  elapsedSeconds: number,
  timeAccel = FLIGHT_TIME_ACCEL,
): FlightPosition | null {
  const current = validPosition(source);
  if (!current) return null;
  if (!validMotionValue(source.velocity) || !validMotionValue(source.heading)) {
    return current;
  }

  const dtSec = Math.max(0, elapsedSeconds) * timeAccel;
  const headingRad = (source.heading * Math.PI) / 180;
  const dxM = source.velocity * Math.sin(headingRad) * dtSec;
  const dyM = source.velocity * Math.cos(headingRad) * dtSec;
  const dLat = dyM / 111_000;
  const cosLat = Math.cos((current.latitude * Math.PI) / 180);
  const dLon = dxM / (111_000 * Math.max(0.1, cosLat));

  return {
    longitude: current.longitude + dLon,
    latitude: current.latitude + dLat,
  };
}
