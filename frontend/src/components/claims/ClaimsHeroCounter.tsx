import type { Claim } from "../../hooks/useClaims";

export function ClaimsHeroCounter({ claims }: { claims: Claim[] }) {
  const totalPayout = claims.reduce((sum, claim) => sum + claim.payout, 0);

  return (
    <div
      style={{
        padding: "40px 24px 24px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontSize: 11,
          color: "var(--text-secondary)",
        }}
      >
        SESSION AUTO-SETTLED
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 64,
          color: "var(--accent-radar)",
          letterSpacing: "-0.02em",
        }}
      >
        {totalPayout}{" "}
        <span style={{ color: "var(--text-tertiary)", fontSize: 16 }}>
          RIA
        </span>
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)",
          fontSize: 12,
        }}
      >
        {claims.length} claims, paid by reactive contract
      </div>
    </div>
  );
}
