import type { CSSProperties } from "react";

import "./ambientAnimations.css";
import { useReducedMotion } from "./useReducedMotion";

interface ScreenPoint {
  x: number;
  y: number;
}

interface TrailDrawProps {
  points: ScreenPoint[];
  reducedMotion?: boolean;
}

function pathData(points: ScreenPoint[]) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function TrailDraw({ points, reducedMotion }: TrailDrawProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;
  const pathStyle: CSSProperties = {
    animation: isReducedMotion ? "none" : undefined,
    animationName: isReducedMotion ? undefined : "traildraw-dash-reveal",
    strokeDasharray: isReducedMotion ? undefined : "100",
  };

  return (
    <svg
      aria-hidden="true"
      className={
        isReducedMotion
          ? "cinema-traildraw is-reduced-motion"
          : "cinema-traildraw is-animated"
      }
      data-testid="trail-draw"
      height="100%"
      style={{ pointerEvents: "none" }}
      width="100%"
    >
      <path
        className={
          isReducedMotion
            ? "traildraw-path traildraw-path-static"
            : "traildraw-path traildraw-path-animated"
        }
        d={pathData(points)}
        data-testid="trail-draw-path"
        pathLength={100}
        style={pathStyle}
      />
    </svg>
  );
}
