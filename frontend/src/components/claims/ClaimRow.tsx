import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Claim } from "../../hooks/useClaims";
import type { EvidenceSubject } from "../../hooks/useEvidenceTimeline";

interface ClaimRowProps {
  c: Claim;
  onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
}

const evidenceButtonStyle: CSSProperties = {
  justifySelf: "end",
  padding: "6px 10px",
  border: "1px solid var(--border-emphasis)",
  borderRadius: 999,
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  lineHeight: 1,
  cursor: "pointer",
};

export function ClaimRow({ c, onEvidence }: ClaimRowProps) {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);

  const goToFlight = () => {
    navigate(`/flight/${c.flight_id}`, { state: { from: "/claims" } });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open flight ${c.flight_id} for policy ${c.policy_id}`}
      onClick={goToFlight}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        goToFlight();
      }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "120px minmax(0, 1fr) 100px 100px minmax(0, 200px) auto",
        padding: "14px 24px",
        width: "100%",
        borderLeft: `2px solid ${isActive ? "var(--accent-radar)" : "transparent"}`,
        borderBottom: "1px solid var(--border-subtle)",
        background: isActive ? "var(--surface-2)" : "var(--surface-1)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        alignItems: "center",
        color: "var(--text-secondary)",
        textAlign: "left",
        cursor: "pointer",
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
      <button
        type="button"
        style={evidenceButtonStyle}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEvidence?.({ kind: "claim", id: c.id });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.stopPropagation();
          }
        }}
      >
        Evidence
      </button>
    </div>
  );
}
