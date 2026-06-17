import { useCinema } from "./CinemaContext";
import { useEventStore } from "../../store/eventStore";

function manualSeconds(remainingMs: number) {
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function ModeIndicator() {
  const cinema = useCinema();
  const wsState = useEventStore((state) => state.wsState);

  let state = "cinema";
  let label = "CINEMA";

  if (wsState === "retrying" || wsState === "closed") {
    state = "data-link-lost";
    label = "DATA LINK LOST · retry";
  } else if (cinema.mode === "interactive") {
    state = "manual";
    label = `MANUAL · ${manualSeconds(cinema.manualRemainingMs)}s`;
  } else if (cinema.realInjectErrorUntil !== null) {
    state = "real-inject-failed";
    label = "REAL · INJECT FAILED";
  } else if (!cinema.protagonist) {
    state = "cinema-waiting";
    label = "CINEMA · WAITING FOR AIRCRAFT";
  }

  return (
    <div
      role="status"
      aria-label={`Cinema mode ${label}`}
      data-testid="mode-indicator"
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        zIndex: 12,
        padding: "8px 10px",
        background: "rgba(11,14,18,0.88)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sharp)",
        color:
          state === "data-link-lost" || state === "real-inject-failed"
            ? "var(--warn-amber)"
            : "var(--accent-radar)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <span data-testid="mode-indicator-label">{label}</span>
      <span data-testid="mode-indicator-state" hidden>
        {state}
      </span>
    </div>
  );
}
