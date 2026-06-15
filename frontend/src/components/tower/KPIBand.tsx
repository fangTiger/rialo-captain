import { useEffect, useRef, useState } from "react";
import { useEventStore } from "../../store/eventStore";

interface KPIBandProps {
  tickId?: number;
}

export function KPIBand({ tickId = 0 }: KPIBandProps) {
  const flares = useEventStore((state) => state.flares);
  const totalPayout = flares.reduce((sum, flare) => sum + flare.payout, 0);
  const [activeTickId, setActiveTickId] = useState(0);
  const previousTickIdRef = useRef(tickId);

  useEffect(() => {
    if (tickId === previousTickIdRef.current) return;
    previousTickIdRef.current = tickId;
    if (tickId <= 0) return;

    setActiveTickId(tickId);
    const timeoutId = window.setTimeout(() => {
      setActiveTickId((current) => (current === tickId ? 0 : current));
    }, 600);

    return () => window.clearTimeout(timeoutId);
  }, [tickId]);

  const isTicking = tickId > 0 && activeTickId === tickId;

  return (
    <div
      aria-live="polite"
      className={`kpi-band${isTicking ? " kpi-band--tick" : ""}`}
      data-testid="kpi-band"
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
        transform: isTicking ? "translateY(-1px)" : "translateY(0)",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        boxShadow: isTicking
          ? "0 0 0 1px rgba(48, 227, 202, 0.45), 0 0 18px rgba(48, 227, 202, 0.24)"
          : "none",
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
