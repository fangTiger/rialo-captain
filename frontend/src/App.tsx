export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        gap: 16,
        padding: 24,
      }}
      aria-label="Rialo-Captain shell"
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
          letterSpacing: 0,
          textTransform: "uppercase",
          fontSize: 12,
        }}
      >
        RIALO · CAPTAIN
      </div>
      <div style={{ fontSize: 40, letterSpacing: 0 }}>Reactive insurance for the real sky</div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--accent-radar)",
          fontSize: 12,
        }}
      >
        bootstrapping · awaiting design tokens go-live
      </div>
    </main>
  );
}
