import { ClaimRow } from "../claims/ClaimRow";
import { useClaimsForFlight } from "../../hooks/useClaimsForFlight";

interface Props {
  flightId: string;
}

export function RelatedClaims({ flightId }: Props) {
  const { claims, isLoading } = useClaimsForFlight(flightId);

  return (
    <section style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        CLAIM HISTORY
      </h2>
      {isLoading ? (
        <div style={{ color: "var(--text-secondary)" }}>loading...</div>
      ) : claims.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-1)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          No claim yet · auto-settled when delayed ≥ 30 min
        </div>
      ) : (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            borderRight: "1px solid var(--border-subtle)",
            borderLeft: "1px solid var(--border-subtle)",
          }}
        >
          {claims.map((claim) => (
            <ClaimRow key={claim.signature} c={claim} />
          ))}
        </div>
      )}
    </section>
  );
}
