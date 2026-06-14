import type { HotRoute } from "../../hooks/useHotRoutes";

export function RouteRow({ r, rank }: { r: HotRoute; rank: number }) {
  const pct = Math.round(r.delay_rate * 100);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 120px 100px",
        padding: "14px 24px",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        alignItems: "center",
      }}
    >
      <div style={{ color: "var(--text-tertiary)" }}>#{rank}</div>
      <div style={{ color: "var(--accent-radar)", fontSize: 16 }}>
        {r.callsign}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "var(--surface-2)" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background:
                pct > 30 ? "var(--warn-amber)" : "var(--accent-radar)",
            }}
          />
        </div>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          {pct}%
        </span>
      </div>
      <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>
        {r.policy_count} pol
      </div>
    </div>
  );
}
