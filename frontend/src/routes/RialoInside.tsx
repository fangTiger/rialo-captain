import { ReactiveDiagram } from "../components/rialo/ReactiveDiagram";

export function RialoInside() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto" }}>
      <section style={{ padding: "120px 24px 80px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontSize: 11,
          }}
        >
          RIALO INSIDE
        </div>
        <h1
          style={{
            marginTop: 18,
            fontSize: 64,
            letterSpacing: 0,
            lineHeight: 1.05,
          }}
        >
          Six roles
          <br />
          <span style={{ color: "var(--accent-radar)" }}>
            collapse into one
          </span>
          .
        </h1>
        <p
          style={{
            marginTop: 24,
            color: "var(--text-secondary)",
            maxWidth: 640,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Traditional onchain insurance needs an oracle service, a keeper bot,
          and a manual review pipeline. Rialo&apos;s reactive contracts read the
          real world directly and settle themselves.
        </p>
      </section>
      <ReactiveDiagram />
      <section style={{ padding: "80px 24px 160px", textAlign: "center" }}>
        <h2
          style={{
            fontSize: 40,
            marginBottom: 16,
            letterSpacing: 0,
          }}
        >
          That&apos;s why{" "}
          <span style={{ color: "var(--accent-radar)" }}>The Tower</span> can
          stay open.
        </h2>
        <p style={{ color: "var(--text-secondary)" }}>
          Built on Rialo · open source · MIT
        </p>
      </section>
    </main>
  );
}
