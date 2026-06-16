import { HangarSlot } from "../hangar/HangarSlot";
import { usePolicies } from "../../hooks/usePolicies";

interface Props {
  flightId: string;
}

export function RelatedPolicies({ flightId }: Props) {
  const { policies, isLoading } = usePolicies();
  const related = policies.filter((policy) => policy.flight_id === flightId);

  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        minWidth: 0,
      }}
    >
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
        YOUR POLICIES ON THIS FLIGHT
      </h2>
      {isLoading ? (
        <div style={{ color: "var(--text-secondary)" }}>loading...</div>
      ) : related.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--surface-1)",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          No policies on this flight
        </div>
      ) : (
        related.map((policy) => <HangarSlot key={policy.id} p={policy} />)
      )}
    </section>
  );
}
