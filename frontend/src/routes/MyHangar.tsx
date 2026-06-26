import { useState } from "react";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { HangarLane } from "../components/hangar/HangarLane";
import { usePolicies } from "../hooks/usePolicies";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

export function MyHangar() {
  const { policies, isLoading } = usePolicies();
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);

  if (isLoading) return <main style={{ padding: 32 }}>loading...</main>;

  const active = policies.filter((p) => p.status === "active");
  const paid = policies.filter((p) => p.status === "paid");
  const expired = policies.filter((p) => p.status === "expired");

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
