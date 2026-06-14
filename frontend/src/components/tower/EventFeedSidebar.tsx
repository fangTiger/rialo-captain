import { useState } from "react";
import { useEventStore } from "../../store/eventStore";

export function EventFeedSidebar() {
  const allFlares = useEventStore((state) => state.flares);
  const flares = allFlares.slice(0, 20);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          padding: "6px 12px",
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          borderRadius: "var(--radius-sharp)",
          cursor: "pointer",
        }}
      >
        EVENT FEED{" "}
        <span style={{ color: "var(--accent-radar)" }}>{allFlares.length}</span>
      </button>
    );
  }

  return (
    <aside
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "70vh",
        overflow: "auto",
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-soft)",
        padding: 16,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}>
          EVENT FEED
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: "transparent",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            width: 22,
            height: 22,
            lineHeight: "20px",
            fontSize: 14,
            padding: 0,
            borderRadius: "var(--radius-sharp)",
          }}
          aria-label="close event feed"
        >
          ×
        </button>
      </div>
      {flares.length === 0 && (
        <div style={{ color: "var(--text-tertiary)" }}>
          awaiting first flare...
        </div>
      )}
      {flares.map((flare) => (
        <div
          key={flare.signature.slice(0, 16)}
          style={{
            padding: "8px 0",
            borderTop: "1px solid var(--border-subtle)",
            display: "grid",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--accent-radar)" }}>
              {flare.flight_id}
            </span>
            <span style={{ color: "var(--text-primary)" }}>
              +{flare.payout} RIA
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              color: "var(--text-tertiary)",
              fontSize: 10,
            }}
          >
            <span>{flare.delay_minutes}m late</span>
            <span>{flare.settle_duration_ms}ms</span>
            <span>{flare.signature.slice(0, 10)}...</span>
          </div>
        </div>
      ))}
    </aside>
  );
}
