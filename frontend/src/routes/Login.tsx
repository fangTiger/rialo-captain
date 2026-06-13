import { GoogleSignIn } from "../auth/GoogleSignIn";

export function Login() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 32,
          padding: 40,
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-soft)",
          maxWidth: 420,
          width: "100%",
          boxShadow: "var(--elev-2)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-secondary)",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          RIALO · CAPTAIN
        </div>
        <h1 style={{ margin: 0, fontSize: 40, lineHeight: 1.05, letterSpacing: 0 }}>
          The tower
          <br />
          <span style={{ color: "var(--accent-radar)" }}>is open</span>.
        </h1>
        <p style={{ margin: 0, color: "var(--text-secondary)" }}>
          Sign in to watch the sky and insure a flight in one click.
        </p>
        <GoogleSignIn />
      </div>
    </main>
  );
}
