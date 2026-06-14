export function RadarSweep() {
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 16,
        width: 56,
        height: 56,
        pointerEvents: "none",
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
  );
}
