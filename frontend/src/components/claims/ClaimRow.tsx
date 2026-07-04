import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Claim } from "../../hooks/useClaims";
import type { EvidenceSubject } from "../../hooks/useEvidenceTimeline";
import { CopilotPromptChip } from "../copilot/CopilotPromptChip";

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
const claimTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

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
        if (event.repeat) return;
        goToFlight();
      }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))",
        gap: 10,
        padding: "14px 16px",
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
        overflowWrap: "anywhere",
      }}
    >
      <div style={{ color: "var(--accent-radar)", minWidth: 0 }}>
        {c.policy_id.slice(0, 10)}…
      </div>
      <div style={{ minWidth: 0 }}>
        {claimTimeFormatter.format(new Date(c.settled_at * 1000))}
      </div>
      <div style={{ minWidth: 0 }}>{c.delay_minutes}m late</div>
      <div style={{ color: "var(--text-primary)", minWidth: 0 }}>
        +{c.payout} RIA
      </div>
      <div style={{ color: "var(--text-tertiary)", minWidth: 0 }}>
        {c.signature.slice(0, 18)}… ({c.settle_duration_ms}ms)
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: 8,
          minWidth: 0,
        }}
      >
        <CopilotPromptChip
          label="Why did this claim pay?"
          subjectType="claim"
          subjectId={c.id}
        />
        <button
          type="button"
          aria-label={`View evidence for claim ${c.id} on flight ${c.flight_id}`}
          style={evidenceButtonStyle}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEvidence?.({ kind: "claim", id: c.id });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.stopPropagation();
              if (event.repeat) {
                event.preventDefault();
              }
            }
          }}
        >
          Evidence
        </button>
      </div>
    </div>
  );
}
