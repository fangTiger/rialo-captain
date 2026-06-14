import { useEventStore } from "../../store/eventStore";

export function KPIBand() {
  const flares = useEventStore((state) => state.flares);
  const totalPayout = flares.reduce((sum, flare) => sum + flare.payout, 0);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 16,
        padding: "10px 14px",
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-soft)",
        display: "flex",
        gap: 20,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      <div>
        <span style={{ color: "var(--text-tertiary)", marginRight: 6 }}>
          SESSION FLARES
        </span>
        <span style={{ color: "var(--accent-radar)" }}>{flares.length}</span>
      </div>
      <div>
        <span style={{ color: "var(--text-tertiary)", marginRight: 6 }}>
          PAYOUT
        </span>
        <span style={{ color: "var(--accent-radar)" }}>{totalPayout}</span>
      </div>
    </div>
  );
}
