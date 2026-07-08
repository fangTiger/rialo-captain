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
              gap: 6,
            }}
          >
            {ticker.slice(0, 6).map((event, index) => {
              const amount = tickerAmount(event);
              const isKeyMoment =
                event.type === "paid" ||
                event.type === "opened" ||
                event.type === "closed" ||
                event.type === "rule";
              const rowOpacity = Math.max(0.35, 1 - index * 0.12);
              return (
                <div
                  key={event.id}
                  role="listitem"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    minHeight: isKeyMoment ? 38 : 30,
                    padding: isKeyMoment ? "8px 10px" : "5px 10px",
                    color: isKeyMoment
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                    background: isKeyMoment
                      ? "var(--command-surface-glass)"
                      : "transparent",
                    border: isKeyMoment
                      ? "1px solid var(--border-subtle)"
                      : "1px solid transparent",
                    borderRadius: "var(--radius-soft)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--font-size-caption)",
                    opacity: rowOpacity,
                    transition: "opacity 240ms ease",
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
                        opacity: isKeyMoment ? 1 : 0.7,
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
