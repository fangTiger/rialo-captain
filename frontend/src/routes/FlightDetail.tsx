import { useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
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

export function FlightDetail() {
  const { id } = useParams();
  const flightId = id ?? "";
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);
  const { flight, error, isLoading } = useFlight(flightId);
  const { policies } = usePolicies();
  const isNotFound = error instanceof ApiError && error.status === 404;
  const activePolicyCount = policies.filter(
    (policy) => policy.flight_id === flightId && policy.status === "active",
  ).length;

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
      <InsureBlock
        flightId={flightId}
        callsign={callsign}
        delayRate={delayRate ?? 0}
        hasActivePolicy={activePolicyCount > 0}
        activePolicyCount={activePolicyCount}
      />
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
