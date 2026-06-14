import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { GoogleSignIn } from "../auth/GoogleSignIn";
import { useMe } from "../hooks/useMe";

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
        {import.meta.env.VITE_DEV_LOGIN_ENABLED === "true" && <DevLoginButton />}
      </div>
    </main>
  );
}

function DevLoginButton() {
  const navigate = useNavigate();
  const { refresh } = useMe();
  const [email, setEmail] = useState("captain@local.dev");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function dev() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch<unknown>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ email, name: "Dev Captain" }),
      });
      await refresh();
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 16,
        border: "1px dashed var(--warn-amber)",
        borderRadius: "var(--radius-sharp)",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontSize: 10,
          color: "var(--warn-amber)",
        }}
      >
        DEV ONLY · BYPASS GOOGLE OAUTH
      </div>
      <input
        aria-label="Dev login email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          padding: "10px 12px",
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      />
      <button
        type="button"
        onClick={dev}
        disabled={busy}
        style={{
          padding: "10px 16px",
          background: "var(--warn-amber)",
          color: "var(--surface-0)",
          border: "none",
          borderRadius: "var(--radius-sharp)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "logging in..." : "Dev Login"}
      </button>
      {err && <div style={{ color: "var(--danger-flare)", fontSize: 12 }}>{err}</div>}
    </div>
  );
}
