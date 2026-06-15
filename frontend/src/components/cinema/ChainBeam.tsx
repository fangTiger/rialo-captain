import type { CSSProperties } from "react";

import "./keyMomentAnimations.css";
import { useReducedMotion } from "./useReducedMotion";

interface ScreenPoint {
  x: number;
  y: number;
}

interface ChainBeamProps {
  from: ScreenPoint;
  to: ScreenPoint;
  txHash: string;
  shortTxHash: string;
  reducedMotion?: boolean;
}

type ChainBeamVars = CSSProperties & {
  "--chainbeam-dx": string;
  "--chainbeam-dy": string;
};

export function ChainBeam({
  from,
  to,
  shortTxHash,
  reducedMotion,
}: ChainBeamProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? prefersReducedMotion;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const midX = from.x + dx / 2;
  const midY = from.y + dy / 2;
  const pulseStyle: ChainBeamVars = {
    "--chainbeam-dx": `${dx}px`,
    "--chainbeam-dy": `${dy}px`,
    animation: isReducedMotion ? "none" : undefined,
    animationName: isReducedMotion ? undefined : "chainbeam-pulse-slide",
  };

  return (
    <div
      className={`cinema-chainbeam ${isReducedMotion ? "is-reduced-motion" : "is-animated"}`}
      data-testid="chainbeam"
      style={{ pointerEvents: "none" }}
    >
      <svg aria-hidden="true" className="chainbeam-svg">
        <line
          className="chainbeam-line"
          data-testid="chainbeam-line"
          x1={from.x}
          x2={to.x}
          y1={from.y}
          y2={to.y}
        />
        <circle
          className={
            isReducedMotion
              ? "chainbeam-pulse chainbeam-pulse-static"
              : "chainbeam-pulse chainbeam-pulse-animated"
          }
          cx={from.x}
          cy={from.y}
          data-testid="chainbeam-pulse"
          r="5"
          style={pulseStyle}
        />
      </svg>
      <span
        className={
          isReducedMotion
            ? "chainbeam-tx chainbeam-tx-static"
            : "chainbeam-tx chainbeam-tx-animated"
        }
        data-testid="chainbeam-tx"
        style={{
          left: midX,
          top: midY,
          transform: isReducedMotion
            ? undefined
            : "translate3d(-50%, -50%, 0)",
          willChange: "transform",
        }}
        title={shortTxHash}
      >
        {shortTxHash}
      </span>
    </div>
  );
}
