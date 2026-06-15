import "./ambientAnimations.css";

import { projectLonLat, type MapViewport, type ViewportSize } from "./cameraMath";
import {
  selectHeatmapFocusPoints,
  type HeatPoint,
} from "./ambientHeatmap";
import { useReducedMotion } from "./useReducedMotion";

interface HeatmapBgProps {
  points: HeatPoint[];
  size: ViewportSize;
  viewport: MapViewport;
  reducedMotion?: boolean;
}

const BASELINE_GLOWS = [
  { id: "atlantic-policy-glow", longitude: -52, latitude: 34, radius: 180 },
  { id: "eurasia-policy-glow", longitude: 24, latitude: 45, radius: 150 },
  { id: "pacific-policy-glow", longitude: 122, latitude: 28, radius: 170 },
];

export function HeatmapBg({
  points,
  size,
  viewport,
  reducedMotion,
}: HeatmapBgProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;
  const focusPoints = selectHeatmapFocusPoints(points);

  return (
    <svg
      aria-hidden="true"
      className={
        isReducedMotion
          ? "cinema-heatmap-bg is-reduced-motion"
          : "cinema-heatmap-bg is-animated heatmap-bg-breath"
      }
      data-testid="heatmap-bg"
      height={size.height}
      style={{ pointerEvents: "none" }}
      viewBox={`0 0 ${size.width} ${size.height}`}
      width={size.width}
    >
      <defs>
        <radialGradient id="heatmap-baseline-gradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 61, 120, 0.22)" />
          <stop offset="62%" stopColor="rgba(183, 71, 255, 0.1)" />
          <stop offset="100%" stopColor="rgba(183, 71, 255, 0)" />
        </radialGradient>
        {focusPoints.map((point, index) => (
          <radialGradient
            cx="50%"
            cy="50%"
            id={`heatmap-gradient-${index}`}
            key={point.id}
            r="50%"
          >
            <stop offset="0%" stopColor="rgba(255, 61, 120, 0.72)" />
            <stop offset="58%" stopColor="rgba(183, 71, 255, 0.24)" />
            <stop offset="100%" stopColor="rgba(183, 71, 255, 0)" />
          </radialGradient>
        ))}
      </defs>
      <g
        className={
          isReducedMotion
            ? "heatmap-bg-layer heatmap-bg-layer-static"
            : "heatmap-bg-layer heatmap-bg-layer-animated"
        }
        data-testid="heatmap-focus-layer"
        style={isReducedMotion ? { animation: "none" } : undefined}
      >
        {BASELINE_GLOWS.map((glow) => {
          const projected = projectLonLat(glow.longitude, glow.latitude, size);
          const x = projected.x * viewport.k + viewport.x;
          const y = projected.y * viewport.k + viewport.y;

          return (
            <circle
              className="heatmap-base-focus"
              cx={x}
              cy={y}
              data-testid="heatmap-base-focus"
              fill="url(#heatmap-baseline-gradient)"
              key={glow.id}
              r={glow.radius}
            />
          );
        })}
        {focusPoints.map((point, index) => {
          const projected = projectLonLat(point.longitude, point.latitude, size);
          const x = projected.x * viewport.k + viewport.x;
          const y = projected.y * viewport.k + viewport.y;

          return (
            <circle
              className="heatmap-focus"
              cx={x}
              cy={y}
              data-testid="heatmap-focus"
              fill={`url(#heatmap-gradient-${index})`}
              key={point.id}
              r={72}
            />
          );
        })}
      </g>
    </svg>
  );
}
