import { useEffect, useState, type CSSProperties } from "react";
import {
  GUIDED_DEMO_SCENARIOS,
  getGuidedDemoScenario,
  type GuidedDemoScenarioId,
  type GuidedDemoState,
} from "./demoDirector";

interface GuidedDemoRailProps {
  state: GuidedDemoState;
  embedded?: boolean;
  onExit: () => void;
  onResume: () => void;
  onStart: () => void;
  onUseRecommendedFlight: () => void;
  onSelectScenario: (scenarioId: GuidedDemoScenarioId) => void;
  onReplaySettlement: () => void;
  onOpenEvidenceStory: () => void;
  onAskScenario: () => void;
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

export const GUIDED_DEMO_NARROW_BREAKPOINT_PX = 980;

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
  embedded = false,
  onExit,
  onResume,
  onStart,
  onUseRecommendedFlight,
  onSelectScenario,
  onReplaySettlement,
  onOpenEvidenceStory,
  onAskScenario,
}: GuidedDemoRailProps) {
  const activeStepIndex = currentStepIndex(state);
  const hasActiveDemo = state.status !== "idle";
  const [isNarrowLayout, setIsNarrowLayout] = useState(() =>
    readIsNarrowGuidedDemoViewport(),
  );
  const scenario = getGuidedDemoScenario(state.selectedScenarioId);
  const replayButtonLabel =
    state.status === "replay" ? "Restart replay" : "Replay settlement";
  const isEmbeddedStackLayout = embedded && !isNarrowLayout;

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowLayout(readIsNarrowGuidedDemoViewport());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      data-layout={
        isNarrowLayout ? "bottom" : isEmbeddedStackLayout ? "stacked" : "top-right"
      }
      data-testid="guided-demo-rail-container"
      style={{
        position: isEmbeddedStackLayout
          ? "static"
          : embedded && isNarrowLayout
          ? "fixed"
          : "absolute",
        top: isEmbeddedStackLayout ? "auto" : isNarrowLayout ? "auto" : 20,
        right: isEmbeddedStackLayout ? "auto" : 20,
        bottom: isEmbeddedStackLayout ? "auto" : isNarrowLayout ? 20 : "auto",
        left: isEmbeddedStackLayout ? "auto" : isNarrowLayout ? 20 : "auto",
        zIndex: isEmbeddedStackLayout ? "auto" : 18,
        width: isNarrowLayout
          ? "auto"
          : isEmbeddedStackLayout
          ? "100%"
          : "calc(100% - 40px)",
        height: isEmbeddedStackLayout ? "100%" : "auto",
        minHeight: isEmbeddedStackLayout ? 0 : undefined,
        display: "flex",
        justifyContent: "flex-end",
        pointerEvents: "none",
      }}
    >
      <section
        data-testid="guided-demo-rail"
        aria-label="Guided rail"
        tabIndex={isEmbeddedStackLayout ? 0 : undefined}
        style={{
          pointerEvents: "auto",
          width: isEmbeddedStackLayout ? "100%" : "min(100%, 21rem)",
          minHeight: isEmbeddedStackLayout ? 0 : undefined,
          maxHeight: isEmbeddedStackLayout ? "100%" : undefined,
          display: "grid",
          gap: 12,
          overflowY: isEmbeddedStackLayout ? "auto" : undefined,
          overscrollBehavior: isEmbeddedStackLayout ? "contain" : undefined,
          padding: 14,
          border: "1px solid var(--border-emphasis)",
          borderRadius: 8,
          background: "rgba(7, 13, 23, 0.9)",
          boxShadow: "var(--elev-2)",
          backdropFilter: "blur(14px)",
          scrollbarColor: isEmbeddedStackLayout
            ? "var(--warn-amber) rgba(232, 227, 213, 0.06)"
            : undefined,
          scrollbarGutter: isEmbeddedStackLayout ? "stable" : undefined,
          scrollbarWidth: isEmbeddedStackLayout ? "thin" : undefined,
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
            Guided flow
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

        <section
          aria-label="Scenario"
          style={{
            display: "grid",
            gap: 10,
            padding: 12,
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            <div
              style={{
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Scenario
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {Object.values(GUIDED_DEMO_SCENARIOS).map((candidate) => {
                const isActive = candidate.id === state.selectedScenarioId;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => onSelectScenario(candidate.id)}
                    aria-pressed={isActive}
                    style={{
                      ...railButtonStyle,
                      minHeight: 42,
                      padding: "8px 10px",
                      background: isActive
                        ? "rgba(111, 255, 200, 0.16)"
                        : "var(--surface-2)",
                      borderColor: isActive
                        ? "var(--accent-radar)"
                        : "var(--border-subtle)",
                      color: isActive
                        ? "var(--accent-radar)"
                        : "var(--text-primary)",
                      textTransform: "none",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {candidate.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                color: "var(--text-primary)",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {scenario.label}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              {scenario.goal}
            </div>
            <div
              style={{
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              {`Next action: ${scenario.nextAction}`}
            </div>
          </div>

          <button type="button" onClick={onAskScenario} style={railButtonStyle}>
            {scenario.promptLabel}
          </button>
        </section>

        {state.status === "idle" ? (
          <button type="button" onClick={onStart} style={railButtonStyle}>
            Start guide
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
            <div
              style={{
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              {state.status === "replay"
                ? `Replay running #${state.replayToken}`
                : `Replay ready #${state.replayToken}`}
            </div>
            <button
              type="button"
              onClick={onReplaySettlement}
              style={railButtonStyle}
            >
              {replayButtonLabel}
            </button>
            <button
              type="button"
              onClick={onOpenEvidenceStory}
              style={railButtonStyle}
            >
              Open evidence story
            </button>
          </div>
        ) : null}

        {hasActiveDemo ? (
          <button type="button" onClick={onExit} style={railButtonStyle}>
            Exit guide
          </button>
        ) : null}
      </section>
    </div>
  );
}

function readIsNarrowGuidedDemoViewport() {
  return window.innerWidth < GUIDED_DEMO_NARROW_BREAKPOINT_PX;
}
