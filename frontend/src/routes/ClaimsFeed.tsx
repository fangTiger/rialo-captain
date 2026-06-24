import { useState } from "react";
import { ClaimRow } from "../components/claims/ClaimRow";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import { EvidenceDrawer } from "../components/evidence/EvidenceDrawer";
import { useClaims } from "../hooks/useClaims";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";

export function ClaimsFeed() {
  const { claims, isLoading } = useClaims();
  const [evidenceSubject, setEvidenceSubject] = useState<EvidenceSubject>(null);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      <ClaimsHeroCounter claims={claims} />
      <section>
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
