import { RouteRow } from "../components/routes/RouteRow";
import {
  CommandPanel,
  MetricDeck,
  RiskTicker,
  SignalPill,
  type RiskTickerItem,
} from "../design/commandCenter";
import { useHotRoutes } from "../hooks/useHotRoutes";

export function HotRoutes() {
  const { routes, isLoading } = useHotRoutes();
  const totalPolicies = routes.reduce((sum, route) => sum + route.policy_count, 0);
  const peakDelayRate = routes.reduce(
    (peak, route) => Math.max(peak, route.delay_rate),
    0,
  );
  const averageSamples =
    routes.length === 0
      ? 0
      : Math.round(
          routes.reduce((sum, route) => sum + route.samples, 0) / routes.length,
        );
  const tickerItems: RiskTickerItem[] = routes.slice(0, 6).map((route) => {
    const probability = Math.round(route.delay_rate * 100);

    return {
      id: route.flight_id,
      label: route.callsign,
      value: `${probability}%`,
      direction: probability >= 30 ? "up" : probability <= 10 ? "down" : "flat",
      detail: `${route.policy_count} policies · ${route.samples} samples`,
      tone: probability >= 30 ? "elevated" : "radar",
    };
  });

  return (
    <main
      className="command-center-shell command-safe-area"
      style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 64px" }}
    >
      <CommandPanel
        aria-label="Hot routes command center"
        eyebrow="HOT ROUTES"
        status={isLoading ? "SYNCING" : "LIVE"}
        title="Route Demand Board"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SignalPill tone={routes.length > 0 ? "radar" : "neutral"}>
              by policy demand
            </SignalPill>
            <SignalPill tone={peakDelayRate >= 0.3 ? "elevated" : "weather"}>
              weather / market watch
            </SignalPill>
            <SignalPill tone="weather">signal-only board</SignalPill>
          </div>
          <MetricDeck
            ariaLabel="Hot route risk metrics"
            metrics={[
              {
                id: "demand-heat",
                label: "DEMAND HEAT",
                value: `${totalPolicies} pol`,
                detail: `${routes.length} active route lanes`,
                tone: totalPolicies > 0 ? "radar" : "neutral",
              },
              {
                id: "weather-market-watch",
                label: "WEATHER / MARKET WATCH",
                value: `${Math.round(peakDelayRate * 100)}% peak`,
                detail: "Delay pressure only; no trade or purchase side effect.",
                tone: peakDelayRate >= 0.3 ? "elevated" : "weather",
              },
              {
                id: "live-route-signals",
                label: "LIVE ROUTE SIGNALS",
                value: `${averageSamples} avg samples`,
                detail: "Rows still navigate to the backend flight id.",
                tone: "guarded",
              },
            ]}
          />
          {tickerItems.length > 0 ? (
            <RiskTicker
              ariaLabel="Hot route signal ticker"
              items={tickerItems}
            />
          ) : null}
        </div>
      </CommandPanel>
      {isLoading && <div style={{ padding: 24 }}>loading…</div>}
      <section style={{ marginTop: 18 }}>
        {routes.map((r, i) => (
          <RouteRow key={r.callsign} r={r} rank={i + 1} />
        ))}
      </section>
    </main>
  );
}
