import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { PremiumPicker } from "../drawer/PremiumPicker";
import { useMe } from "../../hooks/useMe";
import { usePolicies } from "../../hooks/usePolicies";
import { multiplierFor } from "./multiplier";

interface Props {
  flightId: string;
  delayRate: number;
  hasActivePolicy: boolean;
  activePolicyCount: number;
}

export function InsureBlock({
  flightId,
  delayRate,
  hasActivePolicy,
  activePolicyCount,
}: Props) {
  const { refresh: refreshPolicies } = usePolicies();
  const { refresh: refreshMe } = useMe();
  const [premium, setPremium] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const estimatedPayout = Math.round(premium * multiplierFor(delayRate));

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/policies", {
        method: "POST",
        body: JSON.stringify({ flight_id: flightId, premium }),
      });
      await Promise.all([refreshPolicies(), refreshMe()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (hasActivePolicy) {
    const noun = activePolicyCount === 1 ? "policy" : "policies";
    return (
      <section
        style={{
          padding: 20,
          border: "1px solid var(--border-emphasis)",
          background: "var(--surface-2)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <Link
          to="/policies"
          style={{
            color: "var(--accent-radar)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          You hold {activePolicyCount} active {noun} on this flight · view in
          HANGAR →
        </Link>
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
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            color: "var(--text-secondary)",
            fontSize: 12,
          }}
        >
          <span>EST. PAYOUT IF DELAYED ≥ 30 MIN</span>
          <span style={{ color: "var(--accent-radar)", fontSize: 18 }}>
            ≈ {estimatedPayout} RIA
          </span>
        </div>
      </div>
      {err && (
        <div style={{ color: "var(--danger-flare)", fontSize: 12 }}>
          {err}
        </div>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={busy}
        style={{
          padding: "14px 20px",
          background: "var(--accent-radar)",
          color: "var(--surface-0)",
          border: "none",
          borderRadius: "var(--radius-sharp)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: busy ? 0.5 : 1,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? "Confirming..." : `Confirm · ${premium} RIA`}
      </button>
    </section>
  );
}
