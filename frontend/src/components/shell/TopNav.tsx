import { Link, useLocation } from "react-router-dom";
import { useMe } from "../../hooks/useMe";

const TABS = [
  { to: "/", label: "TOWER" },
  { to: "/policies", label: "MY HANGAR" },
  { to: "/claims", label: "CLAIMS FEED" },
  { to: "/routes", label: "HOT ROUTES" },
  { to: "/rialo-inside", label: "RIALO INSIDE" },
];

export function TopNav() {
  const { user } = useMe();
  const loc = useLocation();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: "var(--top-nav-height, 64px)",
        flexWrap: "nowrap",
        gap: 16,
        padding: "12px 24px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(5, 6, 8, 0.92)",
        backdropFilter: "blur(10px)",
        position: "sticky",
        top: 0,
        zIndex: 60,
        overflowX: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: 0,
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 20,
          alignItems: "center",
          flexWrap: "nowrap",
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        <span style={{ color: "var(--accent-radar)", letterSpacing: 0 }}>
          RIALO ◦ CAPTAIN
        </span>
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            style={{
              color:
                loc.pathname === tab.to
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              textDecoration: "none",
              borderBottom:
                loc.pathname === tab.to
                  ? "1px solid var(--accent-radar)"
                  : "1px solid transparent",
              paddingBottom: 4,
            }}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 12,
          flexWrap: "nowrap",
          flexShrink: 0,
          marginLeft: "auto",
        }}
      >
        <span
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            marginRight: 12,
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
