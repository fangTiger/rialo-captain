import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { apiFetch } from "../../api/client";
import {
  CommandPanel,
  MetricDeck,
  SignalPill,
  type CommandMetric,
} from "../../design/commandCenter";
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

export interface PurchasedPolicy {
  id: string;
  flight_id: string;
  premium: number;
  payout: number;
  status: string;
  contract_ref: string;
  created_at: number;
}

interface Props {
  flightId: string;
  onClose: () => void;
  onPurchased?: (policy: PurchasedPolicy) => void;
}

export function BuyDrawer({ flightId, onClose, onPurchased }: Props) {
  const { data: flight } = useSWR<FlightDetailDto>(
    `/flights/${flightId}`,
    (p: string) => apiFetch<FlightDetailDto>(p),
  );
  const { refresh } = useMe();
  const [premium, setPremium] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!flight) {
    return (
      <Shell onClose={onClose}>
        <div
          className="buy-drawer-content"
          style={{ color: "var(--text-secondary)" }}
        >
          loading...
        </div>
      </Shell>
    );
  }

  const estimatedPayout = Math.round(
    premium * multiplierFor(flight.delay_rate),
  );
  const delayProbability = Math.round(flight.delay_rate * 100);
  const decisionMetrics: CommandMetric[] = [
    {
      id: "premium",
      label: "Premium",
      value: `${premium} RIA`,
      detail: "Selected stake",
      tone: "radar",
    },
    {
      id: "estimated-payout",
      label: "Est. payout",
      value: `${estimatedPayout} RIA`,
      detail: "If delayed >= 30 min",
      tone: "elevated",
    },
    {
      id: "delay-probability",
      label: "Delay probability",
      value: `${delayProbability}%`,
      detail: `${flight.samples} samples`,
      tone: delayProbability >= 30 ? "severe" : "guarded",
    },
  ];

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      const policy = await apiFetch<PurchasedPolicy>("/policies", {
        method: "POST",
        body: JSON.stringify({ flight_id: flightId, premium }),
      });
      onPurchased?.(policy);
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
      <div className="buy-drawer-content">
        <CommandPanel
          aria-label="Coverage purchase decision"
          className="buy-drawer-decision-panel"
          eyebrow="COVERAGE OPS"
          status={`${flight.origin} -> ${flight.destination}`}
          title={flight.callsign}
        >
          <MetricDeck
            ariaLabel="Coverage decision metrics"
            className="buy-drawer-metrics"
            metrics={decisionMetrics}
          />
          <div className="buy-drawer-boundary">
            <SignalPill label="Purchase signal boundary" tone="weather">
              Signal-only pricing context
            </SignalPill>
            <span>
              Purchase terms still settle only through contract conditions and
              verified delay evidence.
            </span>
          </div>
        </CommandPanel>
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
  const [closeHovered, setCloseHovered] = useState(false);

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
        aria-label="Buy coverage panel"
        className="buy-drawer-panel command-surface command-safe-area"
        data-testid="buy-drawer-panel"
      >
        <button
          type="button"
          aria-label="Close buy drawer"
          className="command-hit-target command-focus-ring"
          onClick={onClose}
          onMouseEnter={() => setCloseHovered(true)}
          onMouseLeave={() => setCloseHovered(false)}
          style={{
            position: "absolute",
            top: 12,
            right: 16,
            width: 24,
            height: 24,
            border: "none",
            background: "transparent",
            color: closeHovered
              ? "var(--text-primary)"
              : "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
        {children}
      </aside>
      <style>
        {`
          @keyframes slideup {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }

          .buy-drawer-panel {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 51;
            background: var(--command-surface-panel);
            border-top: 1px solid var(--command-border-strong);
            box-shadow: var(--elev-2);
            max-height: 80vh;
            overflow: auto;
            animation: slideup 280ms cubic-bezier(0.22, 1, 0.36, 1);
          }

          .buy-drawer-content {
            padding: 24px;
            display: grid;
            gap: 20px;
          }

          .buy-drawer-decision-panel {
            border-radius: 8px;
          }

          .buy-drawer-metrics {
            grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
            gap: 10px;
          }

          .buy-drawer-metrics .metric-deck__item {
            min-height: 92px;
            display: grid;
            align-content: start;
            padding: 12px;
          }

          .buy-drawer-metrics .metric-deck__label {
            line-height: 1.28;
          }

          .buy-drawer-metrics .metric-deck__value {
            white-space: nowrap;
            overflow-wrap: normal;
          }

          .buy-drawer-metrics .metric-deck__item:nth-child(3) {
            grid-column: 1 / -1;
            min-height: 0;
            grid-template-columns: minmax(0, 1fr) auto;
            grid-template-areas:
              "label value"
              "detail value";
            align-items: center;
            column-gap: 12px;
          }

          .buy-drawer-metrics .metric-deck__item:nth-child(3) .metric-deck__label {
            grid-area: label;
          }

          .buy-drawer-metrics .metric-deck__item:nth-child(3) .metric-deck__value {
            grid-area: value;
            margin-top: 0;
            text-align: right;
          }

          .buy-drawer-metrics .metric-deck__item:nth-child(3) .metric-deck__detail {
            grid-area: detail;
          }

          .buy-drawer-boundary {
            display: grid;
            gap: 8px;
            margin-top: 14px;
            color: var(--text-secondary);
            font-size: var(--font-size-caption);
            line-height: var(--line-height-copy);
          }

          @media (min-width: 820px) {
            .buy-drawer-panel {
              top: calc(var(--top-nav-height, 64px) + 20px);
              right: 20px;
              bottom: 20px;
              left: auto;
              width: min(26rem, calc(100vw - 40px));
              max-height: calc(100vh - var(--top-nav-height, 64px) - 40px);
              border: 1px solid var(--border-emphasis);
              border-radius: 8px;
            }

            .buy-drawer-content {
              padding: 20px;
              gap: 16px;
            }
          }

          @media (max-width: 520px) {
            .buy-drawer-metrics {
              grid-template-columns: minmax(0, 1fr);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .buy-drawer-panel {
              animation: none;
            }
          }
        `}
      </style>
    </>
  );
}
