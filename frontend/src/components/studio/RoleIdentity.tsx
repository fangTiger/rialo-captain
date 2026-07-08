import type { Pool } from "../../api/pool";

interface RoleIdentityProps {
  pool: Pool | null;
}

export function RoleIdentity({ pool }: RoleIdentityProps) {
  const isLive = pool !== null;
  return (
    <section
      aria-label={isLive ? "Underwriter role live" : "Underwriter role intro"}
      style={{
        display: "grid",
        gap: 10,
        padding: "18px 22px",
        background: "var(--command-surface-glass)",
        border: `1px solid ${
          isLive ? "var(--command-border-strong)" : "var(--command-border)"
        }`,
        borderRadius: "var(--radius-soft)",
        boxShadow: isLive ? "var(--glow-command)" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: isLive ? "var(--accent-radar)" : "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-micro)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          {isLive ? "YOU · UNDERWRITING · LIVE" : "YOUR ROLE"}
        </span>
        {isLive ? (
          <span
            style={{
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-micro)",
              letterSpacing: "0.08em",
            }}
          >
            pool {pool!.id.slice(0, 8)}
          </span>
        ) : null}
      </div>
      <h2
        style={{
          margin: 0,
          color: "var(--text-primary)",
          fontSize: "var(--font-size-hud)",
          lineHeight: "var(--line-height-tight)",
        }}
      >
        {isLive
          ? "Your reactive contract is watching flights, binding matching policies, paying claims."
          : "You are the underwriter."}
      </h2>
      {isLive ? null : (
        <p
          style={{
            margin: 0,
            color: "var(--text-secondary)",
            fontSize: "var(--font-size-body)",
            lineHeight: "var(--line-height-copy)",
          }}
        >
          Other travelers buy delay insurance. Your pool decides which policies to take, collects
          premiums, and pays claims when flights delay past your threshold.{" "}
          <span style={{ color: "var(--accent-radar)" }}>
            Rialo&rsquo;s reactive contract does the settlement — you just write the rule.
          </span>
        </p>
      )}
    </section>
  );
}
