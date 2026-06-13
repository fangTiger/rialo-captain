import { useMe } from "../hooks/useMe";

export function TowerShell() {
  const { user } = useMe();

  return (
    <main style={{ minHeight: "100vh", padding: 24, display: "grid", gap: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 16,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.18em",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          THE TOWER · LIVE
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--text-tertiary)" }}>BAL</span>
          <span>{user?.balance ?? "—"} RIA</span>
          <span style={{ color: "var(--text-tertiary)" }}>{user?.email}</span>
        </div>
      </header>
      <section
        style={{
          position: "relative",
          flex: 1,
          minHeight: 480,
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-soft)",
          background: "var(--surface-1)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 12,
            placeItems: "center",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          <div
            className="radar-sweep"
            style={{
              width: 80,
              height: 80,
              border: "1px solid var(--accent-radar-dim)",
              borderTop: "1px solid var(--accent-radar)",
              borderRadius: "50%",
            }}
          />
          <div>map awaiting · plan 3</div>
        </div>
      </section>
    </main>
  );
}
