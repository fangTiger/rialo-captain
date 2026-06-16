import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Policy } from "../../hooks/usePolicies";

const STATUS_COLOR: Record<Policy["status"], string> = {
  active: "var(--accent-radar)",
  paid: "var(--info-beige)",
  expired: "var(--text-tertiary)",
};

export function HangarSlot({ p }: { p: Policy }) {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);

  const goToFlight = () => {
    navigate(`/flight/${p.flight_id}`, { state: { from: "/policies" } });
  };

  return (
    <button
      type="button"
      aria-label={`Open flight ${p.flight_id}`}
      onClick={goToFlight}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        goToFlight();
      }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        padding: 16,
        width: "100%",
        border: "1px solid var(--border-subtle)",
        borderLeft: `2px solid ${isActive ? "var(--accent-radar)" : "transparent"}`,
        borderRadius: "var(--radius-soft)",
        background: isActive ? "var(--surface-2)" : "var(--surface-1)",
        display: "grid",
        gap: 10,
        color: "var(--text-primary)",
        textAlign: "left",
        cursor: "pointer",
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
    </button>
  );
}
