import type { CSSProperties } from "react";

import "./keyMomentAnimations.css";
import { useReducedMotion } from "./useReducedMotion";

interface ShockWaveProps {
  x: number;
  y: number;
  delayMinutes: number;
  reducedMotion?: boolean;
}

const RING_DELAYS = ["0s", "0.18s", "0.36s"];

export function ShockWave({
  x,
  y,
  delayMinutes,
  reducedMotion,
}: ShockWaveProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;
  const ringClassName = isReducedMotion
    ? "shockwave-ring shockwave-ring-static"
    : "shockwave-ring shockwave-ring-animated";

  return (
    <div
      className={`cinema-shockwave ${isReducedMotion ? "is-reduced-motion" : "is-animated"}`}
      data-testid="shockwave"
      style={{ left: x, top: y, pointerEvents: "none" }}
    >
      {RING_DELAYS.map((delay) => {
        const style: CSSProperties = isReducedMotion
          ? { animation: "none" }
          : {
              animationDelay: delay,
              animationName: "shockwave-ring-scale",
            };

        return (
          <span
            aria-hidden="true"
            className={ringClassName}
            data-testid="shockwave-ring"
            key={delay}
            style={style}
          />
        );
      })}
      <span className="shockwave-label">{Math.round(delayMinutes)}M DELAY</span>
    </div>
  );
}
