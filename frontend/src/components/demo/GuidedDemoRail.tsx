import { useEffect, useState, type CSSProperties } from "react";
import type { GuidedDemoState } from "./demoDirector";

interface GuidedDemoRailProps {
  state: GuidedDemoState;
  onExit: () => void;
  onResume: () => void;
  onStart: () => void;
  onUseRecommendedFlight: () => void;
}

const railButtonStyle: CSSProperties = {
  appearance: "none",
  border: "1px solid var(--border-subtle)",
  borderRadius: 6,
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  padding: "10px 12px",
  textTransform: "uppercase",
};

function currentStepIndex(state: GuidedDemoState): 0 | 1 | 2 {
  if (state.status === "buy-cover" || state.status === "paused") return 1;
  if (state.status === "replay" || state.status === "complete") return 2;
  return 0;
}

function Step({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <li
      aria-current={active ? "step" : undefined}
      style={{
        listStyle: "none",
        padding: "8px 10px",
        borderRadius: 6,
        border: "1px solid var(--border-subtle)",
        background: active ? "rgba(111, 255, 200, 0.16)" : "var(--surface-2)",
        color: active ? "var(--accent-radar)" : "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.04em",
      }}
    >
      {label}
    </li>
  );
}

export function GuidedDemoRail({
  state,
  onExit,
  onResume,
  onStart,
  onUseRecommendedFlight,
}: GuidedDemoRailProps) {
  const activeStepIndex = currentStepIndex(state);
  const hasActiveDemo = state.status !== "idle";
  const [isNarrowLayout, setIsNarrowLayout] = useState(() =>
    readIsNarrowGuidedDemoViewport(),
  );

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowLayout(readIsNarrowGuidedDemoViewport());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      data-layout={isNarrowLayout ? "bottom" : "top-right"}
      data-testid="guided-demo-rail-container"
      style={{
        position: "absolute",
        top: isNarrowLayout ? "auto" : 20,
        right: 20,
        bottom: isNarrowLayout ? 20 : "auto",
        left: isNarrowLayout ? 20 : "auto",
        zIndex: 18,
        width: isNarrowLayout ? "auto" : "calc(100% - 40px)",
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      <section
        data-testid="guided-demo-rail"
        aria-label="Guided demo rail"
        style={{
          pointerEvents: "auto",
          width: "min(100%, 21rem)",
          display: "grid",
          gap: 12,
          padding: 14,
          border: "1px solid var(--border-emphasis)",
          borderRadius: 8,
          background: "rgba(7, 13, 23, 0.9)",
          boxShadow: "var(--elev-2)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div
            style={{
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Guided demo
          </div>
          <ol
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
              margin: 0,
              padding: 0,
            }}
          >
            <Step active={activeStepIndex === 0} label="Select flight" />
            <Step active={activeStepIndex === 1} label="Buy cover" />
            <Step active={activeStepIndex === 2} label="Settlement replay" />
          </ol>
        </div>

        {state.status === "idle" ? (
          <button type="button" onClick={onStart} style={railButtonStyle}>
            Start guided demo
          </button>
        ) : null}

        {state.status === "select-flight" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              {state.recommendedFlight ? "Recommended flight" : "Waiting for live flight"}
            </div>
            <div
              style={{
                fontSize: 24,
                fontFamily: "var(--font-mono)",
              }}
            >
              {state.recommendedFlight?.callsign ?? "No recommendation"}
            </div>
            {state.recommendedFlight ? (
              <button
                type="button"
                onClick={onUseRecommendedFlight}
                style={railButtonStyle}
              >
                Use recommended flight
              </button>
            ) : null}
          </div>
        ) : null}

        {state.status === "buy-cover" || state.status === "paused" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Selected flight
            </div>
            <div
              style={{
                fontSize: 24,
                fontFamily: "var(--font-mono)",
              }}
            >
              {state.selectedFlight?.callsign ?? "No flight"}
            </div>
            {state.status === "paused" ? (
              <button type="button" onClick={onResume} style={railButtonStyle}>
                Resume
              </button>
            ) : null}
          </div>
        ) : null}

        {state.status === "replay" || state.status === "complete" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Replay subject
            </div>
            <div
              style={{
                display: "grid",
                gap: 6,
                padding: 12,
                borderRadius: 6,
                background: "var(--surface-2)",
                border: "1px solid var(--border-subtle)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <div>{`Policy ${state.purchasedPolicy?.id ?? "pending"}`}</div>
              <div>{state.purchasedPolicy?.callsign ?? "No flight"}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{`${state.purchasedPolicy?.premium ?? 0} RIA`}</span>
                <span>{`${state.purchasedPolicy?.payout ?? 0} RIA`}</span>
              </div>
            </div>
          </div>
        ) : null}

        {hasActiveDemo ? (
          <button type="button" onClick={onExit} style={railButtonStyle}>
            Exit demo
          </button>
        ) : null}
      </section>
    </div>
  );
}

function readIsNarrowGuidedDemoViewport() {
  return window.innerWidth < 980;
}
