import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMe } from "../../hooks/useMe";
import { usePoolStore } from "../../store/pool";

const TABS = [
  { to: "/", label: "TOWER" },
  { to: "/studio", label: "STUDIO" },
  { to: "/policies", label: "MY HANGAR" },
  { to: "/claims", label: "CLAIMS FEED" },
  { to: "/routes", label: "HOT ROUTES" },
  { to: "/rialo-inside", label: "RIALO INSIDE" },
];

function studioBadge(
  activePool: ReturnType<typeof usePoolStore.getState>["activePool"],
  closedFlashUntil: number,
  now: number,
) {
  if (closedFlashUntil > now) {
    return { label: "CLOSED", color: "var(--warn-amber)" };
  }
  if (!activePool) return null;

  const roundedPl = Math.round(activePool.pl);
  return {
    label: roundedPl >= 0 ? `+${roundedPl}` : `${roundedPl}`,
    color: roundedPl >= 0 ? "var(--accent-radar)" : "var(--warn-amber)",
  };
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      data-testid="rialo-brand-mark"
      style={{
        display: "inline-flex",
        width: 34,
        height: 34,
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block", width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="rialoBrandBg" x1="12" y1="8" x2="56" y2="58">
            <stop offset="0" stopColor="#11212D" />
            <stop offset="0.52" stopColor="#09131B" />
            <stop offset="1" stopColor="#04070B" />
          </linearGradient>
          <linearGradient id="rialoBrandTrail" x1="14" y1="47" x2="41" y2="19">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#5FF2B6" />
          </linearGradient>
          <linearGradient id="rialoBrandAircraft" x1="23" y1="12" x2="41" y2="51">
            <stop offset="0" stopColor="#F1FFFC" />
            <stop offset="1" stopColor="#B8FFF1" />
          </linearGradient>
          <linearGradient id="rialoBrandNode" x1="44" y1="40" x2="53" y2="49">
            <stop offset="0" stopColor="#C8FFF2" />
            <stop offset="1" stopColor="#5FF2B6" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="14" fill="url(#rialoBrandBg)" />
        <rect
          x="4.5"
          y="4.5"
          width="55"
          height="55"
          rx="13.5"
          stroke="rgba(164, 245, 221, 0.18)"
        />
        <path
          d="M14 47C15.8 36.4 21.6 26.6 31 20.8"
          stroke="url(#rialoBrandTrail)"
          strokeOpacity="0.7"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M14 47C16.8 29.6 30.2 20 47 20"
          stroke="#1ED8D4"
          strokeOpacity="0.34"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M12 19C21 16 30 12.8 42 9.8"
          stroke="rgba(191, 240, 228, 0.08)"
          strokeWidth="1.4"
        />
        <g
          data-icon-part="aircraft"
          data-icon-role="primary-aircraft"
          fill="url(#rialoBrandAircraft)"
          stroke="rgba(86, 235, 220, 0.32)"
          strokeWidth="1"
          strokeLinejoin="round"
        >
          <path
            data-aircraft-segment="fuselage"
            d="M32 11.6L35.4 17.6L34.6 49C34.6 50.2 33.6 51.2 32.4 51.2H31.6C30.4 51.2 29.4 50.2 29.4 49L28.6 17.6L32 11.6Z"
          />
          <path
            data-aircraft-segment="main-wing"
            d="M13.4 29.4L29.6 25.4H34.4L50.6 29.4C52.2 29.8 52.2 32.2 50.6 32.6L34.4 36.6H29.6L13.4 32.6C11.8 32.2 11.8 29.8 13.4 29.4Z"
          />
          <path
            data-aircraft-segment="tail-wing"
            d="M22.6 41.4L29.8 38H34.2L41.4 41.4C42.8 42.1 42.4 44.2 40.8 44.2H23.2C21.6 44.2 21.2 42.1 22.6 41.4Z"
          />
        </g>
        <path
          d="M32 15.4V47"
          stroke="rgba(7, 22, 28, 0.32)"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <g
          data-icon-part="confirm-node"
          data-icon-role="secondary-confirmation"
          data-icon-zone="lower-right"
        >
          <circle cx="48.5" cy="46" r="4.8" fill="url(#rialoBrandNode)" />
          <circle
            cx="48.5"
            cy="46"
            r="4.1"
            stroke="rgba(220, 255, 247, 0.52)"
            strokeWidth="1"
          />
          <path
            d="M46.9 45.8L48 46.9L50.4 44.5"
            stroke="#04150F"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </span>
  );
}

export function TopNav() {
  const { user } = useMe();
  const loc = useLocation();
  const activePool = usePoolStore((state) => state.activePool);
  const closedFlashUntil = usePoolStore((state) => state.closedFlashUntil);
  const [now, setNow] = useState(() => Date.now());
  const currentStudioBadge = studioBadge(activePool, closedFlashUntil, now);

  useEffect(() => {
    if (closedFlashUntil <= now) return undefined;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, closedFlashUntil - now + 16),
    );
    return () => window.clearTimeout(timer);
  }, [closedFlashUntil, now]);

  return (
    <nav
      className="top-nav top-nav--responsive command-surface"
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-between",
        minHeight: "var(--top-nav-height, 64px)",
        flexWrap: "wrap",
        gap: 12,
        padding: "10px clamp(14px, 2.4vw, 24px)",
        borderBottom: "1px solid var(--command-border)",
        background: "var(--command-surface-panel)",
        backdropFilter: "blur(18px) saturate(135%)",
        boxShadow:
          "0 1px 0 rgba(0, 255, 157, 0.1), 0 18px 52px rgba(0, 0, 0, 0.28)",
        position: "sticky",
        top: 0,
        zIndex: 60,
        overflowX: "visible",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: 0,
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <div
        className="top-nav__primary"
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          flex: "1 1 520px",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <Link
          aria-label="Rialo Captain home"
          className="top-nav__brand command-focus-ring"
          data-testid="rialo-brand-lockup"
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            flex: "0 1 auto",
            minWidth: 0,
            maxWidth: "100%",
            textDecoration: "none",
            textTransform: "none",
          }}
        >
          <BrandMark />
          <span
            style={{
              color: "var(--text-primary)",
              fontFamily: "var(--font-display)",
              fontSize: 15,
              fontWeight: 620,
              letterSpacing: 0,
              lineHeight: 1,
              overflowWrap: "anywhere",
              whiteSpace: "normal",
            }}
          >
            Rialo Captain
          </span>
        </Link>
        <div
          className="top-nav__tabs"
          aria-label="Primary navigation"
          style={{
            display: "flex",
            alignItems: "center",
            flex: "1 1 340px",
            flexWrap: "wrap",
            gap: "8px 14px",
            minWidth: 0,
          }}
        >
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              className="top-nav__link command-focus-ring"
              to={tab.to}
              style={{
                color:
                  loc.pathname === tab.to
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                flex: "0 1 auto",
                minWidth: 0,
                textDecoration: "none",
                borderBottom:
                  loc.pathname === tab.to
                    ? "1px solid var(--accent-radar)"
                    : "1px solid transparent",
                paddingBottom: 4,
                outlineOffset: 6,
                overflowWrap: "anywhere",
              }}
            >
              <span>{tab.label}</span>
              {tab.to === "/studio" && currentStudioBadge ? (
                <span
                  data-testid="studio-nav-badge"
                  style={{
                    color: currentStudioBadge.color,
                  }}
                >
                  {currentStudioBadge.label}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
      <div
        className="top-nav__status"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "8px 12px",
          flex: "1 1 260px",
          flexWrap: "wrap",
          marginLeft: "auto",
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            marginRight: 4,
          }}
        >
          PRESS /
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>BAL</span>
        <span style={{ color: "var(--text-primary)" }}>
          {user?.balance ?? "—"} RIA
        </span>
        <span
          style={{
            color: "var(--text-tertiary)",
            flex: "1 1 140px",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 180,
          }}
        >
          {user?.email}
        </span>
      </div>
    </nav>
  );
}
