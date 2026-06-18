import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useSWRConfig } from "swr";
import { apiFetch } from "../api/client";
import { GoogleSignIn } from "../auth/GoogleSignIn";
import { resolvePublicDeployConfig } from "../config/deployment";
import "./Login.css";

export function Login() {
  const deployConfig = resolvePublicDeployConfig();
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    shell.toggleAttribute("inert", devPanelOpen);
    if (devPanelOpen) {
      shell.setAttribute("aria-hidden", "true");
      return () => {
        shell.removeAttribute("aria-hidden");
        shell.toggleAttribute("inert", false);
      };
    }

    shell.removeAttribute("aria-hidden");
    shell.toggleAttribute("inert", false);

    if (restoreFocusRef.current) {
      launcherRef.current?.focus();
      restoreFocusRef.current = false;
    }

    return () => {
      shell.removeAttribute("aria-hidden");
      shell.toggleAttribute("inert", false);
    };
  }, [devPanelOpen]);

  function openDevPanel() {
    restoreFocusRef.current = false;
    setDevPanelOpen(true);
  }

  function closeDevPanel() {
    restoreFocusRef.current = true;
    setDevPanelOpen(false);
  }

  function toggleDevPanel() {
    if (devPanelOpen) {
      closeDevPanel();
      return;
    }
    openDevPanel();
  }

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

      <div className="login-shell" ref={shellRef}>
        <header className="login-nav">
          <div className="login-brand" aria-label="Rialo Captain">
            <span className="login-brand-mark" aria-hidden="true" />
            <span>Rialo Captain</span>
          </div>
          <div className="login-nav-links" aria-hidden="true">
            <span>Field</span>
            <span>Routes</span>
            <span>Claims</span>
          </div>
          {deployConfig.devLoginEnabled && (
            <button
              type="button"
              className="login-app-trigger"
              ref={launcherRef}
              aria-expanded={devPanelOpen}
              aria-haspopup="dialog"
              aria-controls="dev-access-card"
              onClick={toggleDevPanel}
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
        <DevLoginCard onClose={closeDevPanel} />
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
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

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

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("disabled"));

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  return (
    <form
      id="dev-access-card"
      className="dev-login-card"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-access-title"
      onSubmit={dev}
      onKeyDown={handleKeyDown}
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
          ref={emailInputRef}
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
