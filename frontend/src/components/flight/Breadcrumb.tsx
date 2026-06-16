import { useLocation, useNavigate } from "react-router-dom";

const SOURCE_LABELS: Record<string, string> = {
  "/claims": "CLAIMS FEED",
  "/policies": "MY HANGAR",
  "/routes": "HOT ROUTES",
};

export function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const from =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";
  const targetPath = SOURCE_LABELS[from] ? from : "/";
  const label = SOURCE_LABELS[from] ?? "TOWER";

  return (
    <button
      type="button"
      onClick={() => navigate(targetPath)}
      style={{
        justifySelf: "start",
        padding: 0,
        border: "none",
        background: "transparent",
        color: "var(--text-secondary)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        letterSpacing: "0.18em",
        cursor: "pointer",
      }}
    >
      ← {label}
    </button>
  );
}
