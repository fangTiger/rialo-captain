interface Props {
  delayRate: number | null;
  samples: number | null;
  multiplier: number | null;
  liveDelayMinutes: number | null;
}

function valueOrDash(value: string | null): string {
  return value ?? "—";
}

export function FlightKPIBand({
  delayRate,
  samples,
  multiplier,
  liveDelayMinutes,
}: Props) {
  const items = [
    {
      label: "DELAY RATE",
      value: valueOrDash(delayRate === null ? null : `${Math.round(delayRate * 100)}%`),
    },
    {
      label: "SAMPLES",
      value: valueOrDash(samples === null ? null : String(samples)),
    },
    {
      label: "MULTIPLIER",
      value: valueOrDash(multiplier === null ? null : `${multiplier.toFixed(1)}×`),
    },
    {
      label: "LIVE STATUS",
      value: valueOrDash(
        liveDelayMinutes === null ? null : `+${liveDelayMinutes} min`,
      ),
    },
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-1)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.18em",
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            padding: "16px 18px",
            borderRight:
              item.label === "LIVE STATUS"
                ? "none"
                : "1px solid var(--border-subtle)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              color: "var(--text-tertiary)",
              fontSize: 10,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              color:
                item.label === "LIVE STATUS" && item.value !== "—"
                  ? "var(--warn-amber)"
                  : "var(--text-primary)",
              fontSize: 18,
              letterSpacing: 0,
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
}
