import type { Claim } from "../../hooks/useClaims";

export function ClaimRow({ c }: { c: Claim }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 100px 100px 200px",
        padding: "14px 24px",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        alignItems: "center",
        color: "var(--text-secondary)",
      }}
    >
      <div style={{ color: "var(--accent-radar)" }}>
        {c.policy_id.slice(0, 10)}…
      </div>
      <div>{new Date(c.settled_at * 1000).toLocaleTimeString()}</div>
      <div>{c.delay_minutes}m late</div>
      <div style={{ color: "var(--text-primary)" }}>+{c.payout} RIA</div>
      <div style={{ color: "var(--text-tertiary)" }}>
        {c.signature.slice(0, 18)}… ({c.settle_duration_ms}ms)
      </div>
    </div>
  );
}
