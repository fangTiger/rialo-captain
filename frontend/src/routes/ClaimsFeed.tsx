import { useState } from "react";
import { ClaimRow } from "../components/claims/ClaimRow";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { CommandPanel, MetricDeck, SignalPill } from "../design/commandCenter";
import { useClaims } from "../hooks/useClaims";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

function formatClaimCount(count: number): string {
  return `${count} ${count === 1 ? "claim" : "claims"}`;
}

export function ClaimsFeed() {
  const { claims, isLoading } = useClaims();
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);
  const totalPayout = claims.reduce((sum, claim) => sum + claim.payout, 0);
  const maxDelayMinutes = claims.reduce(
    (maxDelay, claim) => Math.max(maxDelay, claim.delay_minutes),
    0,
  );
  const fastestSettlementMs =
    claims.length === 0
      ? null
      : Math.min(...claims.map((claim) => claim.settle_duration_ms));

  return (
    <main
      className="command-center-shell command-safe-area"
      style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 80px" }}
    >
      <CommandPanel
        aria-label="Claims command center"
        eyebrow="CLAIMS FEED"
        status={isLoading ? "SYNCING" : "LIVE"}
        title="Claims Command Center"
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SignalPill tone={claims.length > 0 ? "radar" : "neutral"}>
              settlement status
            </SignalPill>
            <SignalPill tone="low">evidence availability</SignalPill>
            <SignalPill tone={maxDelayMinutes >= 30 ? "elevated" : "weather"}>
              route risk context
            </SignalPill>
          </div>
          <MetricDeck
            ariaLabel="Claims posture metrics"
            metrics={[
              {
                id: "recent-claims",
                label: "RECENT CLAIMS",
                value: formatClaimCount(claims.length),
                detail: "Reactive contract settlement feed",
                tone: claims.length > 0 ? "radar" : "neutral",
              },
              {
                id: "settlement-status",
                label: "SETTLEMENT STATUS",
                value: `+${totalPayout} RIA`,
                detail:
                  fastestSettlementMs === null
                    ? "No settlement latency yet"
                    : `Fastest settlement ${fastestSettlementMs}ms`,
                tone: totalPayout > 0 ? "low" : "neutral",
              },
              {
                id: "evidence-availability",
                label: "EVIDENCE AVAILABILITY",
                value: `${claims.length} ready`,
                detail: "Claim evidence opens without leaving this feed.",
                tone: claims.length > 0 ? "guarded" : "neutral",
              },
              {
                id: "route-risk-context",
                label: "ROUTE / FLIGHT RISK",
                value:
                  claims.length === 0
                    ? "No triggered route"
                    : `${maxDelayMinutes}m max delay`,
                detail: "Context only; payout already settled from observed delay.",
                tone: maxDelayMinutes >= 30 ? "elevated" : "weather",
              },
            ]}
          />
        </div>
      </CommandPanel>
      <ClaimsHeroCounter claims={claims} />
      <section style={{ marginTop: 18 }}>
        {isLoading && <div style={{ padding: 24 }}>loading…</div>}
        {claims.map((claim) => (
          <ClaimRow
            key={claim.signature}
            c={claim}
            onEvidence={setEvidenceSubject}
          />
        ))}
      </section>
      <EvidenceDrawer
        subject={evidenceSubject}
        onClose={() => setEvidenceSubject(null)}
      />
    </main>
  );
}
