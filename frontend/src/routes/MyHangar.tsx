import { useState } from "react";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { HangarLane } from "../components/hangar/HangarLane";
import {
  sortActivePolicies,
  summarizeHangarPolicies,
} from "../components/hangar/risk";
import { usePolicies } from "../hooks/usePolicies";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

function formatPolicyCount(count: number): string {
  return `${count} ${count === 1 ? "policy" : "policies"}`;
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
  const summaryItems = [
    {
      label: "ACTIVE EXPOSURE",
      value: `${summary.activeExposure} RIA`,
      tone: "var(--text-primary)",
    },
    {
      label: "MAX POTENTIAL PAYOUT",
      value: `${summary.maxPotentialPayout} RIA`,
      tone: "var(--text-primary)",
    },
    {
      label: "SETTLED PAYOUT",
      value: `${summary.settledPayout} RIA`,
      tone: "var(--info-beige)",
    },
    {
      label: "AT RISK",
      value: formatPolicyCount(summary.atRiskCount),
      tone:
        summary.atRiskCount > 0 ? "var(--warn-amber)" : "var(--text-primary)",
    },
  ];

  return (
    <main
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
      <section
        aria-label="Hangar risk summary"
        style={{
          gridColumn: "1 / -1",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 1,
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-soft)",
          overflow: "hidden",
          background: "var(--border-subtle)",
        }}
      >
        {summaryItems.map((item) => (
          <div
            key={item.label}
            style={{
              padding: "16px 18px",
              background: "var(--surface-1)",
              fontFamily: "var(--font-mono)",
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {item.label}
            </div>
            <div
              style={{
                color: item.tone,
                fontSize: 18,
                letterSpacing: 0,
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </section>
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
