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
        padding: "12px 24px",
        borderBottom: "1px solid var(--border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: 0,
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ color: "var(--text-tertiary)" }}>BAL</span>
        <span style={{ color: "var(--text-primary)" }}>
          {user?.balance ?? "—"} RIA
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>{user?.email}</span>
      </div>
    </nav>
  );
}
