import { useFlights } from "../../hooks/useFlights";

export function DataStaleBadge() {
  const { stale, staleSeconds } = useFlights();

  if (!stale) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 88,
        padding: "6px 10px",
        background: "color-mix(in srgb, var(--warn-amber) 18%, transparent)",
        border: "1px solid var(--warn-amber)",
        color: "var(--warn-amber)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        borderRadius: 4,
      }}
    >
      DATA STALE · {staleSeconds}s
    </div>
  );
}
