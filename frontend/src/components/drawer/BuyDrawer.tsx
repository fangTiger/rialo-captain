import type { ReactNode } from "react";
import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "../../api/client";
import { useMe } from "../../hooks/useMe";
import { multiplierFor } from "../flight/multiplier";
import { DelayHistogram } from "./DelayHistogram";
import { PremiumPicker } from "./PremiumPicker";

interface FlightDetailDto {
  id: string;
  callsign: string;
  origin: string;
  destination: string;
  delay_rate: number;
  samples: number;
}

interface Props {
  flightId: string;
  onClose: () => void;
}

export function BuyDrawer({ flightId, onClose }: Props) {
  const { data: flight } = useSWR<FlightDetailDto>(
    `/flights/${flightId}`,
    (p: string) => apiFetch<FlightDetailDto>(p),
  );
  const { refresh } = useMe();
  const [premium, setPremium] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!flight) {
    return (
      <Shell onClose={onClose}>
        <div style={{ padding: 24, color: "var(--text-secondary)" }}>
          loading...
        </div>
      </Shell>
    );
  }

  const estimatedPayout = Math.round(
    premium * multiplierFor(flight.delay_rate),
  );

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/policies", {
        method: "POST",
        body: JSON.stringify({ flight_id: flightId, premium }),
      });
      await refresh();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell onClose={onClose}>
      <div style={{ padding: 24, display: "grid", gap: 20 }}>
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              letterSpacing: "0.18em",
              fontSize: 11,
              textTransform: "uppercase",
            }}
          >
            FLIGHT
          </div>
          <div style={{ fontSize: 36, marginTop: 4 }}>{flight.callsign}</div>
          <div style={{ color: "var(--text-secondary)", marginTop: 6 }}>
            {flight.origin} -&gt; {flight.destination}
          </div>
        </div>
        <DelayHistogram
          delayRate={flight.delay_rate}
          samples={flight.samples}
        />
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
              letterSpacing: "0.18em",
              fontSize: 11,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            PREMIUM
          </div>
          <PremiumPicker value={premium} onChange={setPremium} />
        </div>
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-2)",
            fontFamily: "var(--font-mono)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 6,
              color: "var(--text-secondary)",
            }}
          >
            <span>EST. PAYOUT IF DELAYED &gt;= 30 MIN</span>
            <span style={{ color: "var(--accent-radar)", fontSize: 18 }}>
              {estimatedPayout} RIA
            </span>
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
            auto-settled by Rialo reactive contract
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
          }}
        >
          {busy ? "Confirming..." : `Confirm - ${premium} RIA`}
        </button>
      </div>
    </Shell>
  );
}

function Shell({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.4)",
          zIndex: 50,
        }}
      />
      <aside
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 51,
          background: "var(--surface-1)",
          borderTop: "1px solid var(--border-emphasis)",
          boxShadow: "var(--elev-2)",
          maxHeight: "80vh",
          overflow: "auto",
          animation: "slideup 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {children}
      </aside>
      <style>
        {`@keyframes slideup { from { transform: translateY(100%); } to { transform: translateY(0); } }`}
      </style>
    </>
  );
}
