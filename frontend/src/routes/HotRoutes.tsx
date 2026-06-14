import { RouteRow } from "../components/routes/RouteRow";
import { useHotRoutes } from "../hooks/useHotRoutes";

export function HotRoutes() {
  const { routes, isLoading } = useHotRoutes();
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 0 64px" }}>
      <h1
        style={{
          padding: "0 24px 24px",
          margin: 0,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontSize: 14,
          color: "var(--text-secondary)",
        }}
      >
        HOT ROUTES{" "}
        <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
          · by policy demand
        </span>
      </h1>
      {isLoading && <div style={{ padding: 24 }}>loading…</div>}
      {routes.map((r, i) => (
        <RouteRow key={r.callsign} r={r} rank={i + 1} />
      ))}
    </main>
  );
}
