type FlightStatus = "IN-FLIGHT" | "SCHEDULED" | "LANDED" | "DELAYED";

const STATUS_COLOR: Record<FlightStatus, string> = {
  "IN-FLIGHT": "var(--accent-radar)",
  SCHEDULED: "var(--text-secondary)",
  LANDED: "var(--text-tertiary)",
  DELAYED: "var(--warn-amber)",
};

interface Props {
  callsign: string;
  origin: string;
  destination: string;
  status: FlightStatus;
}

export function FlightHero({ callsign, origin, destination, status }: Props) {
  const hasRoute = origin.length > 0 && destination.length > 0;

  return (
    <section
      style={{
        minHeight: 240,
        padding: 24,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-1)",
        display: "grid",
        alignContent: "center",
        gap: 28,
        fontFamily: "var(--font-mono)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 72,
            lineHeight: 0.9,
            letterSpacing: 0,
            color: "var(--text-primary)",
          }}
        >
          {callsign}
        </div>
        {hasRoute && (
          <div
            style={{
              padding: "6px 10px",
              border: `1px solid ${STATUS_COLOR[status]}`,
              color: STATUS_COLOR[status],
              borderRadius: "var(--radius-pill)",
              fontSize: 11,
              letterSpacing: "0.18em",
              whiteSpace: "nowrap",
            }}
          >
            {status}
          </div>
        )}
      </div>
      {hasRoute && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 16,
            alignItems: "center",
            color: "var(--text-secondary)",
            fontSize: 18,
          }}
        >
          <span>{origin}</span>
          <span
            aria-hidden="true"
            style={{
              borderTop: "1px dashed var(--text-tertiary)",
              position: "relative",
              height: 1,
            }}
          >
            <span
              style={{
                position: "absolute",
                right: -1,
                top: -9,
                color: "var(--text-tertiary)",
              }}
            >
              &gt;
            </span>
          </span>
          <span>{destination}</span>
        </div>
      )}
    </section>
  );
}
