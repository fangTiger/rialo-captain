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

function normalizedInset(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function resolveSafeAreaAnchor(
  target: CameraTarget,
  size: ViewportSize,
): ProjectedPoint {
  const left = normalizedInset(target.safeAreaInsets?.left);
  const right = normalizedInset(target.safeAreaInsets?.right);
  const top = normalizedInset(target.safeAreaInsets?.top);
  const bottom = normalizedInset(target.safeAreaInsets?.bottom);
  const safeWidth = size.width - left - right;
  const safeHeight = size.height - top - bottom;

  return {
    x:
      safeWidth > 0
        ? clamp(left + safeWidth / 2, 0, size.width)
        : size.width / 2,
    y:
      safeHeight > 0
        ? clamp(top + safeHeight / 2, 0, size.height)
        : size.height / 2,
  };
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
  const anchor = resolveSafeAreaAnchor(target, size);
  return {
    k,
    x: anchor.x - point.x * k,
    y: anchor.y - point.y * k,
  };
}
