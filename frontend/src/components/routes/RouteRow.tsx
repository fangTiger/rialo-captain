import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HotRoute } from "../../hooks/useHotRoutes";

export function RouteRow({ r, rank }: { r: HotRoute; rank: number }) {
  const pct = Math.round(r.delay_rate * 100);
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);

  const goToFlight = () => {
    navigate(`/flight/${r.flight_id}`, { state: { from: "/routes" } });
  };

  return (
    <button
      type="button"
      aria-label={`Open flight ${r.flight_id} for route ${r.callsign}`}
      onClick={goToFlight}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        goToFlight();
      }}
      onMouseEnter={() => setIsActive(true)}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 120px 100px",
        padding: "14px 24px",
        width: "100%",
        border: 0,
        borderLeft: `2px solid ${isActive ? "var(--accent-radar)" : "transparent"}`,
        borderBottom: "1px solid var(--border-subtle)",
        background: isActive ? "var(--surface-2)" : "var(--surface-1)",
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ color: "var(--text-tertiary)" }}>#{rank}</div>
      <div style={{ color: "var(--accent-radar)", fontSize: 16 }}>
        {r.callsign}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: "var(--surface-2)" }}>
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background:
                pct > 30 ? "var(--warn-amber)" : "var(--accent-radar)",
            }}
          />
        </div>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          {pct}%
        </span>
      </div>
      <div style={{ textAlign: "right", color: "var(--text-secondary)" }}>
        {r.policy_count} pol
      </div>
    </button>
  );
}
