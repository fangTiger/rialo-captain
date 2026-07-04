import { useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  CommandPanel,
  DivergenceMeter,
  MetricDeck,
  SignalPill,
  type CommandTone,
} from "../design/commandCenter";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { Breadcrumb } from "../components/flight/Breadcrumb";
import { FlightHero } from "../components/flight/FlightHero";
import { FlightKPIBand } from "../components/flight/FlightKPIBand";
import { InsureBlock } from "../components/flight/InsureBlock";
import { RelatedClaims } from "../components/flight/RelatedClaims";
import { RelatedPolicies } from "../components/flight/RelatedPolicies";
import { CopilotPromptChip } from "../components/copilot/CopilotPromptChip";
import { multiplierFor } from "../components/flight/multiplier";
import { DelayHistogram } from "../components/drawer/DelayHistogram";
import { useFlight } from "../hooks/useFlight";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { usePolicies } from "../hooks/usePolicies";

function statusFor(liveDelayMinutes: number | null) {
  if (liveDelayMinutes !== null && liveDelayMinutes >= 30) return "DELAYED";
  return "IN-FLIGHT";
}

function toneForDelay(delayRate: number | null, liveDelayMinutes: number | null): CommandTone {
  if (liveDelayMinutes !== null && liveDelayMinutes >= 30) return "severe";
  if (delayRate !== null && delayRate >= 0.3) return "elevated";
  if (delayRate !== null) return "low";
  return "neutral";
}

function formatProbability(value: number | null): string {
  return value === null ? "Unavailable" : `${Math.round(value * 100)}%`;
}

export function FlightDetail() {
  const { id } = useParams();
  const flightId = id ?? "";
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);
  const { flight, error, isLoading } = useFlight(flightId);
  const { policies, isLoading: policiesLoading } = usePolicies();
  const isNotFound = error instanceof ApiError && error.status === 404;
  const activePolicies = policies.filter(
    (policy) => policy.flight_id === flightId && policy.status === "active",
  );

  if (isLoading && !flight && !isNotFound) {
    return (
      <main
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "32px 24px 96px",
          display: "grid",
          gap: 18,
        }}
      >
        <Breadcrumb />
        <div style={{ color: "var(--text-secondary)" }}>loading...</div>
      </main>
    );
  }

  const delayRate = flight?.delay_rate ?? null;
  const samples = flight?.samples ?? null;
  const liveDelayMinutes = flight?.live_delay_minutes ?? null;
  const multiplier = delayRate === null ? null : multiplierFor(delayRate);
  const callsign = flight?.callsign ?? flightId;
  const origin = flight?.origin ?? "";
  const destination = flight?.destination ?? "";
  const marketProbability =
    delayRate === null ? null : Math.max(0.05, Math.min(0.95, delayRate * 0.82));
  const divergence =
    delayRate === null || marketProbability === null
      ? 0
      : Math.round((delayRate - marketProbability) * 100);
  const flightTone = toneForDelay(delayRate, liveDelayMinutes);
  const purchaseDecision =
    policiesLoading
      ? "Policy check pending"
      : activePolicies.length > 0
      ? "Active policy locked"
      : multiplier === null
        ? "Quote paused"
        : "Open quote";

  return (
    <main
      className="command-center-shell command-safe-area"
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "32px 24px 96px",
        display: "grid",
        gap: 18,
      }}
    >
      <Breadcrumb />
      {isNotFound && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            border: "1px solid var(--danger-flare)",
            background: "var(--surface-1)",
            color: "var(--danger-flare)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          Flight no longer tracked · ID: {flightId}
        </div>
      )}
      <FlightHero
        callsign={callsign}
        origin={origin}
        destination={destination}
        status={statusFor(liveDelayMinutes)}
      />
      <FlightKPIBand
        delayRate={delayRate}
        samples={samples}
        multiplier={multiplier}
        liveDelayMinutes={liveDelayMinutes}
      />
      <CommandPanel
        aria-label="Flight command center"
        eyebrow="SINGLE FLIGHT RISK"
        status={liveDelayMinutes === null ? "SIGNAL PENDING" : "LIVE"}
        title="Flight Command Center"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SignalPill tone={flightTone}>
              {statusFor(liveDelayMinutes)}
            </SignalPill>
            <SignalPill tone="weather">signal-only context</SignalPill>
            <SignalPill
              tone={
                policiesLoading
                  ? "weather"
                  : activePolicies.length > 0
                    ? "elevated"
                    : "radar"
              }
            >
              {purchaseDecision}
            </SignalPill>
          </div>
          <MetricDeck
            ariaLabel="Flight command metrics"
            metrics={[
              {
                id: "risk-kpi",
                label: "RISK KPI",
                value: formatProbability(delayRate),
                detail:
                  samples === null
                    ? "Historical sample window unavailable"
                    : `${samples} tracked samples`,
                tone: flightTone,
              },
              {
                id: "weather-context",
                label: "WEATHER CONTEXT",
                value:
                  liveDelayMinutes === null
                    ? "Freshness pending"
                    : `Live delay +${liveDelayMinutes} min`,
                detail: "Contextual pressure only; settlement still follows observed delay.",
                tone: liveDelayMinutes !== null && liveDelayMinutes >= 30 ? "severe" : "weather",
              },
              {
                id: "market-context",
                label: "MARKET CONTEXT",
                value:
                  multiplier === null
                    ? "Quote unavailable"
                    : `${multiplier.toFixed(1)}x payout curve`,
                detail: `Market implied ${formatProbability(marketProbability)}`,
                tone: "guarded",
              },
              {
                id: "purchase-decision",
                label: "PURCHASE DECISION",
                value: purchaseDecision,
                detail:
                  policiesLoading
                    ? "Quote controls remain locked until active policies are known."
                    : activePolicies.length > 0
                    ? "Duplicate purchase stays disabled by active holding."
                    : "Existing quote controls remain below.",
                tone: policiesLoading
                  ? "weather"
                  : activePolicies.length > 0
                    ? "elevated"
                    : "radar",
              },
              {
                id: "evidence-ready",
                label: "EVIDENCE READY",
                value: isNotFound ? "Route retained" : "Flight facts ready",
                detail: "Policy and claim evidence open through existing drawers.",
                tone: "low",
              },
            ]}
          />
          <DivergenceMeter
            label="Model vs market divergence"
            tone={Math.abs(divergence) > 10 ? "elevated" : "radar"}
            value={divergence}
          />
        </div>
      </CommandPanel>
      <section
        style={{
          padding: "16px 18px",
          border: "1px solid var(--border-subtle)",
          background: "var(--surface-1)",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 0.18,
            textTransform: "uppercase",
            color: "var(--accent-radar)",
          }}
        >
          Ask Rialo
        </div>
        <div
          style={{
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Pull an AI read on this flight before you inspect policies, claims, or
          evidence.
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <CopilotPromptChip
            label="Why is this flight risky?"
            subjectType="flight"
            subjectId={flightId}
          />
          <CopilotPromptChip
            label="Summarize the delay evidence"
            subjectType="flight"
            subjectId={flightId}
          />
        </div>
      </section>
      <DelayHistogram delayRate={delayRate ?? 0} samples={samples ?? 0} />
      {policiesLoading ? (
        <CommandPanel
          aria-label="Policy lock check"
          eyebrow="POLICY LOCK CHECK"
          status="SYNCING"
          title="Quote Locked"
        >
          <div style={{ display: "grid", gap: 12 }}>
            <SignalPill tone="weather">active policy scan pending</SignalPill>
            <div
              style={{
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              Purchase controls stay hidden until Rialo confirms whether this
              flight already has an active policy.
            </div>
          </div>
        </CommandPanel>
      ) : (
        <InsureBlock
          flightId={flightId}
          callsign={callsign}
          delayRate={delayRate}
          activePolicies={activePolicies}
          onEvidence={setEvidenceSubject}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          alignItems: "start",
        }}
      >
        <RelatedPolicies
          flightId={flightId}
          onEvidence={setEvidenceSubject}
        />
        <RelatedClaims flightId={flightId} onEvidence={setEvidenceSubject} />
      </div>
      <EvidenceDrawer
        subject={evidenceSubject}
        onClose={() => setEvidenceSubject(null)}
      />
    </main>
  );
}
