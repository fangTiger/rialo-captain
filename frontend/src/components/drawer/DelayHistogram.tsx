interface Props {
  delayRate: number;
  samples: number;
}

export function DelayHistogram({ delayRate, samples }: Props) {
  const pct = Math.round(delayRate * 100);
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div
        style={{
          color: "var(--text-secondary)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        DELAY RATE (last {samples} obs)
      </div>
      <div
        style={{
          height: 10,
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background:
              pct > 30 ? "var(--warn-amber)" : "var(--accent-radar)",
          }}
        />
      </div>
      <div style={{ marginTop: 6, color: "var(--text-tertiary)" }}>
        {pct}% historical
      </div>
    </div>
  );
}
