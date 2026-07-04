import { useState } from "react";
import {
  CommandPanel,
  MetricDeck,
  SignalPill,
  type CommandTone,
} from "../design/commandCenter";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { HangarLane } from "../components/hangar/HangarLane";
import {
  getPolicyLiveDelayMinutes,
  getPolicyRiskLevel,
  sortActivePolicies,
  summarizeHangarPolicies,
} from "../components/hangar/risk";
import { usePolicies } from "../hooks/usePolicies";
import type { PolicyRiskLevel } from "../hooks/usePolicies";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

function formatPolicyCount(count: number): string {
  return `${count} ${count === 1 ? "policy" : "policies"}`;
}

function riskTone(level: PolicyRiskLevel | null): CommandTone {
  if (level === "triggered") return "severe";
  if (level === "watch") return "elevated";
  if (level === "normal") return "low";
  if (level === "unknown") return "weather";
  return "neutral";
}

export function MyHangar() {
  const { policies, isLoading } = usePolicies();
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);

  if (isLoading) return <main style={{ padding: 32 }}>loading...</main>;

  const summary = summarizeHangarPolicies(policies);
  const active = sortActivePolicies(
    policies.filter((policy) => policy.status === "active"),
  );
  const paid = policies.filter((policy) => policy.status === "paid");
  const expired = policies.filter((policy) => policy.status === "expired");
  const highestRiskLevel = active[0] ? getPolicyRiskLevel(active[0]) : null;
  const liveSignalCount = policies.filter(
    (policy) => getPolicyLiveDelayMinutes(policy) !== null,
  ).length;
  const summaryItems = [
    {
      id: "active-exposure",
      label: "ACTIVE EXPOSURE",
      value: `${summary.activeExposure} RIA`,
      tone: "radar" as CommandTone,
    },
    {
      id: "max-payout",
      label: "MAX POTENTIAL PAYOUT",
      value: `${summary.maxPotentialPayout} RIA`,
      tone: summary.maxPotentialPayout > 0 ? "elevated" : "neutral" as CommandTone,
    },
    {
      id: "settled-payout",
      label: "SETTLED PAYOUT",
      value: `${summary.settledPayout} RIA`,
      tone: "guarded" as CommandTone,
    },
    {
      id: "at-risk",
      label: "AT RISK",
      value: formatPolicyCount(summary.atRiskCount),
      tone:
        summary.atRiskCount > 0 ? "elevated" as CommandTone : "neutral" as CommandTone,
    },
    {
      id: "highest-risk",
      label: "HIGHEST RISK",
      value: highestRiskLevel?.toUpperCase() ?? "CLEAR",
      tone: riskTone(highestRiskLevel),
    },
    {
      id: "live-signals",
      label: "LIVE SIGNALS",
      value: `${liveSignalCount} live`,
      tone: liveSignalCount > 0 ? "weather" as CommandTone : "neutral" as CommandTone,
    },
  ];

  return (
    <main
      className="command-center-shell command-safe-area"
      style={{
        padding: "32px 24px 64px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 24,
        alignItems: "start",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <CommandPanel
        aria-label="Hangar risk summary"
        eyebrow="MY HANGAR"
        status={liveSignalCount > 0 ? "LIVE" : "STALE"}
        title="Hangar Risk Summary"
        style={{
          gridColumn: "1 / -1",
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <SignalPill tone={summary.atRiskCount > 0 ? "elevated" : "low"}>
              {formatPolicyCount(active.length)} active
            </SignalPill>
            <SignalPill tone="weather">
              {liveSignalCount > 0 ? "freshness live" : "freshness pending"}
            </SignalPill>
            <SignalPill tone={riskTone(highestRiskLevel)}>
              highest {highestRiskLevel?.toUpperCase() ?? "CLEAR"}
            </SignalPill>
          </div>
          <MetricDeck ariaLabel="Hangar risk metrics" metrics={summaryItems} />
        </div>
      </CommandPanel>
      <HangarLane
        title="ACTIVE"
        policies={active}
        onEvidence={setEvidenceSubject}
      />
      <HangarLane title="PAID" policies={paid} onEvidence={setEvidenceSubject} />
      <HangarLane
        title="EXPIRED"
        policies={expired}
        onEvidence={setEvidenceSubject}
      />
      <EvidenceDrawer
        subject={evidenceSubject}
        onClose={() => setEvidenceSubject(null)}
      />
    </main>
  );
}
