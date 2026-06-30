import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Policy, PolicyRiskLevel } from "../../hooks/usePolicies";
import type { EvidenceSubject } from "../../hooks/useEvidenceTimeline";
import { CopilotPromptChip } from "../copilot/CopilotPromptChip";
import {
  getPolicyDelayThresholdMinutes,
  getPolicyLiveDelayMinutes,
  getPolicyMinutesUntilTrigger,
  getPolicyRiskLevel,
  getPolicyRiskReason,
} from "./risk";

const STATUS_COLOR: Record<Policy["status"], string> = {
  active: "var(--accent-radar)",
  paid: "var(--info-beige)",
  expired: "var(--text-tertiary)",
};

const RISK_COLOR: Record<PolicyRiskLevel, string> = {
  triggered: "var(--warn-amber)",
  watch: "var(--accent-radar)",
  unknown: "var(--info-beige)",
  normal: "var(--text-secondary)",
  settled: "var(--info-beige)",
  inactive: "var(--text-tertiary)",
};

interface HangarSlotProps {
  p: Policy;
  onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
}

const evidenceButtonStyle: CSSProperties = {
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

function metricPillStyle(color: string): CSSProperties {
  return {
    padding: "6px 10px",
    border: "1px solid var(--border-subtle)",
    borderRadius: 999,
    background: "var(--surface-2)",
    color,
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    lineHeight: 1.3,
  };
}

export function HangarSlot({ p, onEvidence }: HangarSlotProps) {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const riskLevel = getPolicyRiskLevel(p);
  const riskReason = getPolicyRiskReason(p);
  const liveDelayMinutes = getPolicyLiveDelayMinutes(p);
  const delayThresholdMinutes = getPolicyDelayThresholdMinutes(p);
  const minutesUntilTrigger = getPolicyMinutesUntilTrigger(p);

  const liveDelayLabel =
    liveDelayMinutes === null
      ? "Live delay unavailable"
      : `Live delay +${liveDelayMinutes}m`;
  const thresholdLabel =
    p.status !== "active"
      ? riskLevel === "settled"
        ? `${delayThresholdMinutes}m threshold settled`
        : `${delayThresholdMinutes}m threshold inactive`
      : minutesUntilTrigger === null
        ? `${delayThresholdMinutes}m threshold unavailable`
        : minutesUntilTrigger === 0
          ? `${delayThresholdMinutes}m threshold reached`
          : `${minutesUntilTrigger}m to ${delayThresholdMinutes}m threshold`;

  const goToFlight = () => {
    navigate(`/flight/${p.flight_id}`, { state: { from: "/policies" } });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open flight ${p.flight_id}`}
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
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
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
            display: "grid",
            justifyItems: "end",
            gap: 8,
          }}
        >
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
          <span
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <CopilotPromptChip
              label="Explain this policy"
              subjectType="policy"
              subjectId={p.id}
            />
            <button
              type="button"
              aria-label={`View evidence for policy ${p.id} on flight ${p.flight_id}`}
              style={evidenceButtonStyle}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEvidence?.({ kind: "policy", id: p.id });
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
          </span>
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={metricPillStyle(RISK_COLOR[riskLevel])}>
          {riskLevel.toUpperCase()}
        </span>
        <span style={metricPillStyle("var(--text-secondary)")}>
          {liveDelayLabel}
        </span>
        <span style={metricPillStyle("var(--text-secondary)")}>
          {thresholdLabel}
        </span>
        <span
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            lineHeight: 1.4,
            minWidth: 0,
          }}
        >
          {riskReason}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: 20,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          flexWrap: "wrap",
          rowGap: 8,
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
