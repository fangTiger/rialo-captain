import type { Policy } from "../../hooks/usePolicies";
import type { EvidenceSubject } from "../../hooks/useEvidenceTimeline";
import { HangarSlot } from "./HangarSlot";

interface Props {
  title: string;
  policies: Policy[];
  onEvidence?: (subject: NonNullable<EvidenceSubject>) => void;
}

export function HangarLane({ title, policies, onEvidence }: Props) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
        }}
      >
        {title}{" "}
        <span style={{ color: "var(--text-tertiary)", marginLeft: 6 }}>
          · {policies.length}
        </span>
      </h2>
      {policies.length === 0 ? (
        <div
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          none
        </div>
      ) : (
        policies.map((p) => (
          <HangarSlot key={p.id} p={p} onEvidence={onEvidence} />
        ))
      )}
    </section>
  );
}
