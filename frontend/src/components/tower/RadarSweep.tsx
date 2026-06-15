interface RadarSweepProps {
  atRisk?: boolean;
  protagonistCallsign?: string;
}

export function RadarSweep({
  atRisk = false,
  protagonistCallsign,
}: RadarSweepProps) {
  return (
    <div
      data-testid="radar-sweep-root"
      style={{
        position: "absolute",
        top: 80,
        left: 16,
        width: 150,
        height: 56,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "1px solid var(--border-subtle)",
          overflow: "hidden",
        }}
      >
        <div
          className="radar-sweep"
          style={{
            width: "100%",
            height: "100%",
            background:
              "conic-gradient(from 0deg, transparent 0deg, var(--accent-radar-dim) 60deg, transparent 90deg)",
          }}
        />
      </div>
      {atRisk && (
        <div
          data-testid="radar-at-risk"
          aria-label={`${protagonistCallsign ?? "Protagonist"} AT RISK`}
          style={{
            position: "absolute",
            left: 66,
            top: 18,
            minWidth: 74,
            padding: "4px 6px",
            background: "rgba(255,180,0,0.16)",
            border: "1px solid var(--warn-amber)",
            color: "var(--warn-amber)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          AT RISK
        </div>
      )}
    </div>
  );
}
