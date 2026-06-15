import {
  projectLonLat,
  type MapViewport,
  type ViewportSize,
} from "./cameraMath";
import type { ScreenPoint } from "./keyMomentGeometry";

export interface TrailSource {
  longitude: number | null | undefined;
  latitude: number | null | undefined;
  heading?: number | null;
  velocity?: number | null;
}

export interface TrailCoordinate {
  longitude: number;
  latitude: number;
}

function coordinateFromSource(source: TrailSource): TrailCoordinate | null {
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
  return (
    {
      longitude,
      latitude,
    }
  );
}

function isValidHeading(heading: unknown): heading is number {
  return typeof heading === "number" && Number.isFinite(heading);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function offsetCoordinate(
  origin: TrailCoordinate,
  heading: number,
  distanceKm: number,
): TrailCoordinate {
  const radians = (heading * Math.PI) / 180;
  const east = Math.sin(radians);
  const north = Math.cos(radians);
  const kmPerDegreeLat = 111.32;
  const kmPerDegreeLon =
    kmPerDegreeLat * Math.max(0.2, Math.cos((origin.latitude * Math.PI) / 180));

  return {
    longitude: origin.longitude - (east * distanceKm) / kmPerDegreeLon,
    latitude: origin.latitude - (north * distanceKm) / kmPerDegreeLat,
  };
}

function fallbackTrail(current: TrailCoordinate): TrailCoordinate[] {
  return [
    {
      longitude: current.longitude - 0.42,
      latitude: current.latitude - 0.22,
    },
    {
      longitude: current.longitude - 0.26,
      latitude: current.latitude - 0.12,
    },
    {
      longitude: current.longitude - 0.11,
      latitude: current.latitude - 0.04,
    },
    current,
  ];
}

export function buildTrailPoints(source: TrailSource): TrailCoordinate[] | null {
  const current = coordinateFromSource(source);
  if (!current) return null;

  if (!isValidHeading(source.heading)) return fallbackTrail(current);

  const velocity = typeof source.velocity === "number" ? source.velocity : 220;
  const totalDistanceKm = clamp((velocity * 180) / 1000, 25, 80);

  return [
    offsetCoordinate(current, source.heading, totalDistanceKm),
    offsetCoordinate(current, source.heading, totalDistanceKm * 0.66),
    offsetCoordinate(current, source.heading, totalDistanceKm * 0.33),
    current,
  ];
}

export function projectTrailPoints(
  points: TrailCoordinate[] | null,
  size: ViewportSize,
  viewport: MapViewport,
): ScreenPoint[] | null {
  if (!points || points.length === 0) return null;
  return points.map((point) => {
    const projected = projectLonLat(point.longitude, point.latitude, size);
    return {
      x: projected.x * viewport.k + viewport.x,
      y: projected.y * viewport.k + viewport.y,
    };
  });
}
