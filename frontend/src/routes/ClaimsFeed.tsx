import { ClaimRow } from "../components/claims/ClaimRow";
import { ClaimsHeroCounter } from "../components/claims/ClaimsHeroCounter";
import { useClaims } from "../hooks/useClaims";

export function ClaimsFeed() {
  const { claims, isLoading } = useClaims();

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      <ClaimsHeroCounter claims={claims} />
      <section>
        {isLoading && <div style={{ padding: 24 }}>loading…</div>}
        {claims.map((claim) => (
          <ClaimRow key={claim.signature} c={claim} />
        ))}
      </section>
    </main>
  );
}
