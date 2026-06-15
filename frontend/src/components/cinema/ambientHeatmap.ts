import type { CinemaEvent } from "../../store/eventStore";

export const HEATMAP_LOOKBACK_MS = 300_000;
export const HEATMAP_RAW_POINT_CAP = 120;
export const HEATMAP_FOCUS_POINT_CAP = 32;

export interface HeatPoint {
  id: string;
  eventId: string;
  policyId: string;
  flightId: string;
  longitude: number;
  latitude: number;
  createdAt: number;
  weight: number;
  source: string;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function timestampMs(value: unknown, fallback: number) {
  const numeric = numberValue(value);
  if (numeric === null) return fallback;
  return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
}

function validCoordinate(longitude: number, latitude: number) {
  return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

export function heatPointFromPolicyEvent(
  event: CinemaEvent,
  seenEventIds: ReadonlySet<string> = new Set(),
): HeatPoint | null {
  if (event.type !== "policy.created") return null;
  if (seenEventIds.has(event.id)) return null;

  const payload = event.payload;
  const policyId = stringValue(payload.policy_id);
  const flightId = stringValue(payload.flight_id);
  const longitude = numberValue(payload.longitude);
  const latitude = numberValue(payload.latitude);

  if (
    !policyId ||
    !flightId ||
    longitude === null ||
    latitude === null ||
    !validCoordinate(longitude, latitude)
  ) {
    return null;
  }

  return {
    id: `${event.id}:heat`,
    eventId: event.id,
    policyId,
    flightId,
    longitude,
    latitude,
    createdAt: timestampMs(payload.created_at, event.receivedAt),
    weight: 1,
    source: stringValue(payload.source) ?? "unknown",
  };
}

export function pruneHeatPoints(
  points: HeatPoint[],
  now: number,
  lookbackMs = HEATMAP_LOOKBACK_MS,
) {
  return points.filter((point) => now - point.createdAt <= lookbackMs);
}

export function capHeatPoints(points: HeatPoint[], cap = HEATMAP_RAW_POINT_CAP) {
  return points.slice(-cap);
}

export function selectHeatmapFocusPoints(
  points: HeatPoint[],
  cap = HEATMAP_FOCUS_POINT_CAP,
) {
  return capHeatPoints(points, cap);
}
