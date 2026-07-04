import { ReactiveDiagram } from "../components/rialo/ReactiveDiagram";
import { CommandPanel, MetricDeck, SignalPill } from "../design/commandCenter";

export function RialoInside() {
  return (
    <main
      className="command-center-shell command-safe-area"
      style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "32px 24px 120px",
        display: "grid",
        gap: 28,
      }}
    >
      <CommandPanel
        aria-label="Rialo Inside command center"
        eyebrow="RIALO INSIDE"
        status="SYSTEM LIVE"
        title="Reactive Risk Architecture"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
            gap: 22,
            alignItems: "start",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "var(--font-size-display)",
                letterSpacing: 0,
                lineHeight: 1.05,
              }}
            >
              Six roles
              <br />
              <span style={{ color: "var(--accent-radar)" }}>
                collapse into one
              </span>
              .
            </h1>
            <p
              style={{
                marginTop: 18,
                color: "var(--text-secondary)",
                maxWidth: 560,
                lineHeight: 1.55,
              }}
            >
              Traditional onchain insurance needs an oracle service, a keeper
              bot, and a manual review pipeline. Rialo&apos;s reactive
              contracts read the real world directly and settle themselves.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
              }}
            >
              <SignalPill tone="radar">reactive contract</SignalPill>
              <SignalPill tone="weather">flight signal</SignalPill>
              <SignalPill tone="low">auto settlement</SignalPill>
            </div>
          </div>
          <MetricDeck
            ariaLabel="Rialo Inside topology metrics"
            metrics={[
              {
                id: "system-topology",
                label: "SYSTEM TOPOLOGY",
                value: "Direct read",
                detail:
                  "Frontend, flight data, and reactive contract stay visible in one loop.",
                tone: "radar",
              },
              {
                id: "risk-controls",
                label: "RISK CONTROLS",
                value: "No keeper",
                detail:
                  "Oracle service, keeper bot, and admin review collapse out of path.",
                tone: "guarded",
              },
              {
                id: "settlement-loop",
                label: "SETTLEMENT LOOP",
                value: "Auto settle",
                detail: "Observed delay triggers claim and balance credit flow.",
                tone: "low",
              },
              {
                id: "signal-path",
                label: "SIGNAL PATH",
                value: "Flight -> policy",
                detail: "Risk context stays explanatory; evidence remains factual.",
                tone: "weather",
              },
            ]}
          />
        </div>
      </CommandPanel>
      <ReactiveDiagram />
      <CommandPanel
        aria-label="Tower operating posture"
        eyebrow="OPERATING POSTURE"
        status="ALWAYS ON"
        title="Tower Availability"
      >
        <h2
          style={{
            fontSize: "var(--font-size-display)",
            margin: 0,
            letterSpacing: 0,
          }}
        >
          That&apos;s why{" "}
          <span style={{ color: "var(--accent-radar)" }}>The Tower</span> can
          stay open.
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: "12px 0 0" }}>
          Built on Rialo · open source · MIT
        </p>
      </CommandPanel>
    </main>
  );
}
