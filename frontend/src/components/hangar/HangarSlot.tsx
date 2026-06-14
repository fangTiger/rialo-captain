import type { Policy } from "../../hooks/usePolicies";

const STATUS_COLOR: Record<Policy["status"], string> = {
  active: "var(--accent-radar)",
  paid: "var(--info-beige)",
  expired: "var(--text-tertiary)",
};

export function HangarSlot({ p }: { p: Policy }) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-soft)",
        background: "var(--surface-1)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            color: STATUS_COLOR[p.status],
          }}
        >
          {p.flight_id}
        </span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: "var(--surface-2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: STATUS_COLOR[p.status],
          }}
        >
          {p.status}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 20,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        <div>
          <div
            style={{
              color: "var(--text-tertiary)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 10,
            }}
          >
            PREMIUM
          </div>
          <div>{p.premium} RIA</div>
        </div>
        <div>
          <div
            style={{
              color: "var(--text-tertiary)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 10,
            }}
          >
            PAYOUT
          </div>
          <div>{p.payout} RIA</div>
        </div>
        <div>
          <div
            style={{
              color: "var(--text-tertiary)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              fontSize: 10,
            }}
          >
            CONTRACT
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            {p.contract_ref.slice(0, 10)}...
          </div>
        </div>
      </div>
    </div>
  );
}
