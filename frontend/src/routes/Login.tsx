import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";
import { apiFetch } from "../api/client";
import { GoogleSignIn } from "../auth/GoogleSignIn";
import { resolvePublicDeployConfig } from "../config/deployment";
import "./Login.css";

export function Login() {
  const deployConfig = resolvePublicDeployConfig();
  const [devPanelOpen, setDevPanelOpen] = useState(false);

  return (
    <main className={`login-page${devPanelOpen ? " login-page--dev-open" : ""}`}>
      <div
        className="login-radar-field"
        data-testid="login-radar-field"
        aria-hidden="true"
      >
        <div className="login-radar-field__mesh" />
        <div className="login-radar-field__rings" />
        <div className="login-radar-field__sweep" />
        <div className="login-radar-field__wash" />
      </div>
      <div
        className="login-flight-trails"
        data-testid="login-flight-trails"
        aria-hidden="true"
      >
        <span className="login-flight-trail login-flight-trail--alpha" />
        <span className="login-flight-trail login-flight-trail--bravo" />
        <span className="login-flight-trail login-flight-trail--charlie" />
        <span className="login-flight-trail login-flight-trail--delta" />
      </div>
      <div
        className="login-pulse-layer"
        data-testid="login-pulse-layer"
        aria-hidden="true"
      >
        <span className="login-pulse login-pulse--primary" />
        <span className="login-pulse login-pulse--secondary" />
        <span className="login-pulse login-pulse--tertiary" />
        <span className="login-beacon login-beacon--primary" />
        <span className="login-beacon login-beacon--secondary" />
      </div>

      <div className="login-shell">
        <header className="login-nav">
          <div className="login-brand" aria-label="Rialo Captain">
            <span className="login-brand-mark" aria-hidden="true" />
            <span>Rialo Captain</span>
          </div>
          <nav className="login-nav-links" aria-label="Login page sections">
            <span>Field</span>
            <span>Routes</span>
            <span>Claims</span>
          </nav>
          {deployConfig.devLoginEnabled && (
            <button
              type="button"
              className="login-app-trigger"
              aria-expanded={devPanelOpen}
              aria-haspopup="dialog"
              aria-controls="dev-access-card"
              onClick={() => setDevPanelOpen((open) => !open)}
            >
              Latch APP
            </button>
          )}
        </header>

        <section className="login-hero" aria-labelledby="login-title">
          <div className="login-hero-copyblock">
            <div className="login-hero-kicker">RIALO · CAPTAIN</div>
            <h1 id="login-title">
              <span>Latch Tower</span>
              <span>before the sky turns.</span>
            </h1>
            <p className="login-hero-copy">
              Live tower access for flight cover and claims.
            </p>
            <div className="login-hero-strip" aria-label="Tower status">
              <div className="login-status-chip">
                <span className="login-status-chip__label">Radar</span>
                <strong>Live field</strong>
              </div>
              <div className="login-status-chip">
                <span className="login-status-chip__label">Cover</span>
                <strong>Ready latch</strong>
              </div>
              <div className="login-status-chip">
                <span className="login-status-chip__label">Claims</span>
                <strong>Warm relay</strong>
              </div>
            </div>
          </div>

          <div className="login-access-stack">
            <div className="login-access-panel" aria-label="Production sign in">
              <div>
                <span className="login-panel-eyebrow">Production access</span>
                <h2>Enter the live tower</h2>
                <p className="login-panel-copy">
                  Google-auth clearance into the active flight field.
                </p>
              </div>
              <div className="login-panel-body">
                <GoogleSignIn />
              </div>
            </div>

            <div className="login-signal-panel" aria-label="Tower field indicators">
              <div className="login-signal-panel__row">
                <span>Radar</span>
                <span className="login-signal-value">Sweep live</span>
              </div>
              <div className="login-signal-panel__row">
                <span>Cover</span>
                <span className="login-signal-value login-signal-value--warn">
                  Bind ready
                </span>
              </div>
              <div className="login-signal-panel__row">
                <span>Relay</span>
                <span className="login-signal-value">Claims warm</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {deployConfig.devLoginEnabled && devPanelOpen && (
        <DevLoginCard onClose={() => setDevPanelOpen(false)} />
      )}
    </main>
  );
}

function DevLoginCard({
  onClose,
}: {
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const [email, setEmail] = useState("captain@local.dev");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function dev(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiFetch<unknown>("/auth/dev-login", {
        method: "POST",
        body: JSON.stringify({ email, name: "Dev Captain" }),
      });
      await mutate("/me");
      navigate("/", { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      id="dev-access-card"
      className="dev-login-card"
      role="dialog"
      aria-labelledby="dev-access-title"
      onSubmit={dev}
    >
      <div className="dev-login-card__header">
        <div>
          <span className="dev-login-card__eyebrow">DEV relay</span>
          <h2 id="dev-access-title">DEV access</h2>
        </div>
        <button
          type="button"
          className="dev-login-card__close"
          aria-label="Close DEV access"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <p className="dev-login-card__copy">
        Manual session issue for local tower entry.
      </p>
      <label className="dev-login-card__field">
        <span>Operator email</span>
        <input
          aria-label="Dev login email"
          autoComplete="email"
          placeholder="captain@local.dev"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button
        type="submit"
        className="dev-login-card__submit"
        disabled={busy}
      >
        {busy ? "Logging in..." : "Dev Login"}
      </button>
      {err && <div className="dev-login-card__error">{err}</div>}
    </form>
  );
}
