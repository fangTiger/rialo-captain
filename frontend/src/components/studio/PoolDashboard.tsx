import type { Pool } from "../../api/pool";
import { MetricDeck } from "../../design/commandCenter";
import type { PoolTickerEvent } from "../../store/pool";

interface PoolDashboardProps {
  pool: Pool;
  exposure: number;
  hits24h: number;
  paidOut: number;
  ticker: PoolTickerEvent[];
}

function formatRia(value: number) {
  return `${Math.round(value)} RIA`;
}

function formatSignedRia(value: number) {
  if (value > 0) return `+${Math.round(value)} RIA`;
  if (value < 0) return `${Math.round(value)} RIA`;
  return "0 RIA";
}

function tickerAmount(event: PoolTickerEvent) {
  if (typeof event.amount !== "number") return null;
  if (event.type === "paid") return `-${Math.round(event.amount)} RIA`;
  if (event.type === "bound") return `+${Math.round(event.amount)} RIA`;
  return formatSignedRia(event.amount);
}

export function PoolDashboard({
  pool,
  exposure,
  hits24h,
  paidOut,
  ticker,
}: PoolDashboardProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--layout-panel-gap)",
      }}
    >
      <MetricDeck
        ariaLabel="Pool KPI band"
        metrics={[
          {
            id: "exposure",
            label: "EXPOSURE",
            value: formatRia(exposure),
            detail: "Forward payout at risk",
            tone: "weather",
          },
          {
            id: "hits",
            label: "HITS 24H",
            value: hits24h,
            detail: "Simulator binds",
            tone: "radar",
          },
          {
            id: "paid",
            label: "PAID OUT",
            value: formatRia(paidOut),
            detail: "Claims paid by pool",
            tone: paidOut > 0 ? "elevated" : "neutral",
          },
          {
            id: "pl",
            label: "P/L",
            value: formatSignedRia(pool.pl),
            detail: `Balance ${formatRia(pool.balance)}`,
            tone: pool.pl >= 0 ? "radar" : "elevated",
          },
        ]}
      />
      <section
        aria-label="Pool events"
        style={{
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-micro)",
            textTransform: "uppercase",
          }}
        >
          Event ticker
        </div>
        {ticker.length > 0 ? (
          <div
            aria-label="Pool event ticker"
            role="list"
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            {ticker.map((event) => {
              const amount = tickerAmount(event);
              return (
                <div
                  key={event.id}
                  role="listitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    minHeight: 38,
                    padding: "8px 10px",
                    color: "var(--text-primary)",
                    background: "var(--command-surface-glass)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-soft)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--font-size-caption)",
                  }}
                >
                  <span>{event.label}</span>
                  {amount ? (
                    <span
                      style={{
                        color:
                          event.type === "paid"
                            ? "var(--warn-amber)"
                            : "var(--accent-radar)",
                      }}
                    >
                      {amount}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: 12,
              color: "var(--text-secondary)",
              background: "var(--command-surface-glass)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-soft)",
              fontSize: "var(--font-size-body)",
            }}
          >
            Waiting for simulator demand
          </div>
        )}
      </section>
    </div>
  );
}
