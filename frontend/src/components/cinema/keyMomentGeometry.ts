import { projectLonLat, type MapViewport, type ViewportSize } from "./cameraMath";
import type { CoordinateLocator, MomentLocator } from "./keyMoments";

const AIRPORT_COORDS: Record<string, CoordinateLocator> = {
  CDG: { kind: "coordinates", longitude: 2.55, latitude: 49.0097 },
  DXB: { kind: "coordinates", longitude: 55.3657, latitude: 25.2532 },
  HND: { kind: "coordinates", longitude: 139.7798, latitude: 35.5494 },
  JFK: { kind: "coordinates", longitude: -73.7781, latitude: 40.6413 },
  LHR: { kind: "coordinates", longitude: -0.4543, latitude: 51.47 },
  SFO: { kind: "coordinates", longitude: -122.379, latitude: 37.6213 },
  SIN: { kind: "coordinates", longitude: 103.9915, latitude: 1.3644 },
};

export interface ScreenPoint {
  x: number;
  y: number;
}

export function resolveLocator(locator: MomentLocator): CoordinateLocator | null {
  if (locator.kind === "coordinates") return locator;
  return AIRPORT_COORDS[locator.airportIata.toUpperCase()] ?? null;
}

export function projectMomentPoint(
  locator: MomentLocator | null | undefined,
  size: ViewportSize,
  viewport: MapViewport,
): ScreenPoint | null {
  if (!locator) return null;
  const resolved = resolveLocator(locator);
  if (!resolved) return null;

  const projected = projectLonLat(resolved.longitude, resolved.latitude, size);
  return {
    x: projected.x * viewport.k + viewport.x,
    y: projected.y * viewport.k + viewport.y,
  };
}

export function hangarAnchorForSize(size: ViewportSize): ScreenPoint {
  return {
    x: size.width - 96,
    y: 72,
  };
}
