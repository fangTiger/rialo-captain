import { HangarLane } from "../components/hangar/HangarLane";
import { usePolicies } from "../hooks/usePolicies";

export function MyHangar() {
  const { policies, isLoading } = usePolicies();

  if (isLoading) return <main style={{ padding: 32 }}>loading...</main>;

  const active = policies.filter((p) => p.status === "active");
  const paid = policies.filter((p) => p.status === "paid");
  const expired = policies.filter((p) => p.status === "expired");

  return (
    <main
      style={{
        padding: "32px 24px 64px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 24,
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <HangarLane title="ACTIVE" policies={active} />
      <HangarLane title="PAID" policies={paid} />
      <HangarLane title="EXPIRED" policies={expired} />
    </main>
  );
}
