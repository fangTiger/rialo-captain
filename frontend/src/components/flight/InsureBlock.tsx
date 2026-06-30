import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { PremiumPicker } from "../drawer/PremiumPicker";
import { useMe } from "../../hooks/useMe";
import { usePolicies, type Policy } from "../../hooks/usePolicies";
import type { EvidenceSubject } from "../../hooks/useEvidenceTimeline";
import { useEventStore } from "../../store/eventStore";
import {
  getPolicyRiskLevel,
  getPolicyRiskReason,
  sortActivePolicies,
} from "../hangar/risk";
import { multiplierFor } from "./multiplier";

interface Props {
  flightId: string;
  callsign: string;
  delayRate: number | null;
  activePolicies: Policy[];
  onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
}

export function InsureBlock({
  flightId,
  callsign,
  delayRate,
  activePolicies,
  onEvidence,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const addToast = useEventStore((state) => state.addToast);
  const { refresh: refreshPolicies } = usePolicies();
  const { refresh: refreshMe } = useMe();
  const [premium, setPremium] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const multiplier = delayRate === null ? null : multiplierFor(delayRate);
  const estimatedPayout =
    multiplier === null ? null : Math.round(premium * multiplier);
  const canPurchase = multiplier !== null;
  const sortedActivePolicies = sortActivePolicies(activePolicies);
  const highestRiskPolicy = sortedActivePolicies[0] ?? null;
  const activePolicyCount = sortedActivePolicies.length;
  const activePremiumTotal = sortedActivePolicies.reduce(
    (total, policy) => total + policy.premium,
    0,
  );
  const activePotentialPayoutTotal = sortedActivePolicies.reduce(
    (total, policy) => total + policy.payout,
    0,
  );
  const highestRiskLevel =
    highestRiskPolicy === null ? null : getPolicyRiskLevel(highestRiskPolicy);
  const highestRiskReason =
    highestRiskPolicy === null ? null : getPolicyRiskReason(highestRiskPolicy);

  async function confirm() {
    if (!canPurchase) return;

    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/policies", {
        method: "POST",
        body: JSON.stringify({ flight_id: flightId, premium }),
      });
      await Promise.all([refreshPolicies(), refreshMe()]);
      setBusy(false);
      addToast({
        id: `insure-${Date.now()}`,
        message: `✓ Insured · ${callsign} · ${premium} RIA`,
      });
      const target =
        typeof location.state === "object" &&
        location.state !== null &&
        "from" in location.state
          ? String((location.state as { from: unknown }).from)
          : "/";
      navigate(target);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (activePolicyCount > 0) {
    const noun = activePolicyCount === 1 ? "policy" : "policies";
    return (
      <section
        style={{
          padding: 20,
          border: "1px solid var(--border-emphasis)",
          background: "var(--surface-2)",
          display: "grid",
          gap: 16,
        }}
      >
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
          ACTIVE HOLDING
        </h2>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-primary)",
            display: "grid",
            gap: 8,
          }}
        >
          <div>{activePolicyCount} active {noun} on this flight</div>
          {highestRiskLevel !== null && (
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Highest risk signal: {highestRiskLevel.toUpperCase()}
            </div>
          )}
          {highestRiskReason && (
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {highestRiskReason}
            </div>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              label: "ACTIVE PREMIUM",
              value: `${activePremiumTotal} RIA`,
              tone: "var(--text-primary)",
            },
            {
              label: "POTENTIAL PAYOUT",
              value: `${activePotentialPayoutTotal} RIA`,
              tone: "var(--accent-radar)",
            },
            {
              label: "HIGHEST RISK",
              value: highestRiskLevel?.toUpperCase() ?? "UNKNOWN",
              tone: "var(--warn-amber)",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: 14,
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-1)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {item.label}
              </div>
              <div style={{ color: item.tone, fontSize: 18 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            aria-label={`View evidence for active holdings on ${callsign}`}
            onClick={() => {
              if (!highestRiskPolicy) return;
              onEvidence?.({ kind: "policy", id: highestRiskPolicy.id });
            }}
            style={{
              padding: "10px 14px",
              border: "1px solid var(--border-emphasis)",
              background: "var(--surface-1)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              cursor: highestRiskPolicy ? "pointer" : "default",
            }}
          >
            Evidence
          </button>
          <Link
            to="/policies"
            style={{
              color: "var(--accent-radar)",
              textDecoration: "none",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.02em",
            }}
          >
            View in Hangar
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        padding: 20,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-2)",
        display: "grid",
        gap: 16,
      }}
    >
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
        INSURE
      </h2>
      <PremiumPicker value={premium} onChange={setPremium} />
      <div
        style={{
          padding: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-1)",
          fontFamily: "var(--font-mono)",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "PREMIUM TIER", value: `${premium} RIA` },
            {
              label: "ESTIMATED PAYOUT",
              value:
                estimatedPayout === null
                  ? "Quote unavailable"
                  : `≈ ${estimatedPayout} RIA`,
            },
            {
              label: "MULTIPLIER",
              value: multiplier === null ? "Signal unavailable" : `${multiplier.toFixed(1)}×`,
            },
            {
              label: "HISTORICAL DELAY RATE",
              value: delayRate === null ? "—" : `${Math.round(delayRate * 100)}%`,
            },
            { label: "COVERAGE", value: "Delayed ≥ 30 min" },
          ].map((item) => (
            <div key={item.label} style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {item.label}
              </div>
              <div
                style={{
                  color:
                    item.label === "ESTIMATED PAYOUT"
                      ? "var(--accent-radar)"
                      : "var(--text-primary)",
                  fontSize: item.label === "ESTIMATED PAYOUT" ? 18 : 14,
                  letterSpacing: 0,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 12,
            lineHeight: 1.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          SETTLEMENT
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Rialo reactive contract watches flight data and settles
          automatically.
        </div>
        {!canPurchase && (
          <div
            style={{
              color: "var(--warn-amber)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            Flight signal unavailable. Quote paused until tracking resumes.
          </div>
        )}
      </div>
      {err && (
        <div style={{ color: "var(--danger-flare)", fontSize: 12 }}>
          {err}
        </div>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={busy || !canPurchase}
        aria-label={canPurchase ? undefined : "Flight signal unavailable"}
        style={{
          padding: "14px 20px",
          background: "var(--accent-radar)",
          color: "var(--surface-0)",
          border: "none",
          borderRadius: "var(--radius-sharp)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: busy || !canPurchase ? 0.5 : 1,
          cursor: busy || !canPurchase ? "default" : "pointer",
        }}
      >
        {busy
          ? "Confirming..."
          : canPurchase
            ? `Confirm · ${premium} RIA`
            : "Flight signal unavailable"}
      </button>
    </section>
  );
}
