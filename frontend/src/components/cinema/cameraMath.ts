import type { CameraTarget } from "./CinemaContext";

export interface ViewportSize {
  width: number;
  height: number;
}

export interface MapViewport {
  k: number;
  x: number;
  y: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

const MIN_CAMERA_K = 0.6;
const MAX_CAMERA_K = 12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function projectLonLat(
  longitude: number,
  latitude: number,
  size: ViewportSize,
): ProjectedPoint {
  const scale = size.width / (2 * Math.PI);
  return {
    x: size.width / 2 + scale * ((longitude * Math.PI) / 180),
    y: size.height / 2 - scale * ((latitude * Math.PI) / 180),
  };
}

export function cameraTargetToViewport(
  target: CameraTarget,
  size: ViewportSize,
): MapViewport {
  if (target.reason === "global") {
    return { k: 1, x: 0, y: 0 };
  }

  const k = clamp(target.zoom, MIN_CAMERA_K, MAX_CAMERA_K);
  const point = projectLonLat(target.longitude, target.latitude, size);
  return {
    k,
    x: size.width / 2 - point.x * k,
    y: size.height / 2 - point.y * k,
  };
}
