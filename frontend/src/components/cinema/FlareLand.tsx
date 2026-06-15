import type { CSSProperties } from "react";

import "./keyMomentAnimations.css";
import { useReducedMotion } from "./useReducedMotion";

interface FlareLandProps {
  x: number;
  y: number;
  headingDeg?: number;
  reducedMotion?: boolean;
}

export function FlareLand({
  x,
  y,
  headingDeg = 0,
  reducedMotion,
}: FlareLandProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;
  const ringStyle: CSSProperties = isReducedMotion
    ? { animation: "none" }
    : { animationName: "flareland-ping-scale" };

  return (
    <div
      className={`cinema-flareland ${isReducedMotion ? "is-reduced-motion" : "is-animated"}`}
      data-testid="flareland"
      style={{ left: x, top: y, pointerEvents: "none" }}
    >
      <span
        aria-hidden="true"
        className={
          isReducedMotion
            ? "flareland-ring flareland-ring-static"
            : "flareland-ring flareland-ring-animated"
        }
        data-testid="flareland-ring"
        style={ringStyle}
      />
      <span
        aria-hidden="true"
        className="flareland-heading"
        data-testid="flareland-heading"
        style={{ transform: `rotate(${headingDeg}deg)` }}
      />
      <span className="flareland-label">FLARE</span>
    </div>
  );
}
