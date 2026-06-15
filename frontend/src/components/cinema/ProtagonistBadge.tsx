import { useOptionalCinema, type CinemaProtagonist } from "./CinemaContext";

interface ProtagonistBadgeProps {
  protagonist?: CinemaProtagonist | null;
  queuedCount?: number;
}

function protagonistLabel(protagonist: CinemaProtagonist | null) {
  if (!protagonist) return "DEMO";
  if (protagonist.kind === "DEMO_OFFLINE") return "DEMO · OFFLINE";
  if (protagonist.kind === "REAL") return "REAL · LIVE";
  return "DEMO";
}

export function ProtagonistBadge({
  protagonist: protagonistProp,
  queuedCount: queuedCountProp,
}: ProtagonistBadgeProps) {
  const cinema = useOptionalCinema();
  const protagonist = protagonistProp ?? cinema?.protagonist ?? null;
  const queuedCount = queuedCountProp ?? cinema?.realQueue.length ?? 0;
  const label = protagonistLabel(protagonist);
  const queueLabel = queuedCount > 0 ? `+${queuedCount} more` : "";
  const callsign = protagonist?.callsign ?? "WAITING";
  const ariaLabel = queueLabel
    ? `Protagonist ${label} ${callsign} ${queueLabel}`
    : `Protagonist ${label} ${callsign}`;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      data-testid="protagonist-badge"
      style={{
        position: "absolute",
        top: 58,
        right: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        maxWidth: 260,
        padding: "8px 10px",
        background: "rgba(11,14,18,0.86)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-sharp)",
        color:
          protagonist?.kind === "REAL"
            ? "var(--accent-radar)"
            : "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <span>{label}</span>
      <span
        style={{
          color: "var(--text-tertiary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {callsign}
      </span>
      {queueLabel && (
        <span
          data-testid="protagonist-queue-count"
          style={{
            color: "var(--warn-amber)",
            whiteSpace: "nowrap",
          }}
        >
          {queueLabel}
        </span>
      )}
    </div>
  );
}
