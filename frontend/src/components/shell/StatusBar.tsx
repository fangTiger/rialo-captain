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
      className="status-bar command-surface command-safe-area"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "calc(34px + env(safe-area-inset-bottom))",
        display: "flex",
        alignItems: "center",
        gap: 16,
        paddingTop: 0,
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        borderTop: "1px solid var(--command-border)",
        background: "var(--command-surface-panel)",
        boxShadow:
          "0 -1px 0 rgba(0, 255, 157, 0.08), 0 -18px 48px rgba(0, 0, 0, 0.24)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-secondary)",
        letterSpacing: 0,
        textTransform: "uppercase",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="status-bar__signal"
          data-state={wsState}
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-pill)",
            background: COLORS[wsState],
            boxShadow:
              wsState === "open"
                ? "0 0 12px var(--accent-radar-dim)"
                : "0 0 8px rgba(255, 180, 0, 0.12)",
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
