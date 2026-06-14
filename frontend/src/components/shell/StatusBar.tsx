import { useEventStore, type WsState } from "../../store/eventStore";

const COLORS: Record<WsState, string> = {
  idle: "var(--text-tertiary)",
  connecting: "var(--warn-amber)",
  retrying: "var(--warn-amber)",
  open: "var(--accent-radar)",
  closed: "var(--danger-flare)",
};

export function StatusBar() {
  const wsState = useEventStore((state) => state.wsState);
  const flareCount = useEventStore((state) => state.flares.length);

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--surface-1)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-secondary)",
        letterSpacing: 0,
        textTransform: "uppercase",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-pill)",
            background: COLORS[wsState],
            boxShadow:
              wsState === "open" ? "0 0 8px var(--accent-radar-dim)" : "none",
          }}
        />
        <span>{wsState}</span>
      </div>
      <div style={{ color: "var(--text-tertiary)" }}>·</div>
      <div>
        FLARES{" "}
        <span style={{ color: "var(--text-primary)" }}>{flareCount}</span>
      </div>
    </footer>
  );
}
