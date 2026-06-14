import { useEffect, useRef, useState } from "react";

const STAGES = [
  { left: "User", right: "User" },
  { left: "Frontend", right: "Frontend" },
  { left: "Oracle service", right: "—" },
  { left: "Keeper bot", right: "—" },
  { left: "Admin review", right: "—" },
  { left: "Contract", right: "Reactive Contract" },
];

export function ReactiveDiagram() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const start = window.innerHeight;
      const end = -ref.current.offsetHeight + window.innerHeight;
      const p = Math.min(
        1,
        Math.max(0, (start - rect.top) / Math.max(1, start - end)),
      );
      setProgress(p);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const visibleStages = Math.floor(progress * STAGES.length);

  return (
    <section
      ref={ref}
      style={{
        minHeight: "100vh",
        padding: "120px 24px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 48,
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      <div>
        <h3
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontSize: 12,
            marginBottom: 32,
          }}
        >
          TRADITIONAL
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          {STAGES.map((s, i) => (
            <div
              key={s.left}
              style={{
                padding: "14px 18px",
                border: "1px solid var(--border-subtle)",
                background: "var(--surface-1)",
                fontFamily: "var(--font-mono)",
                opacity: i < visibleStages ? 1 : 0.2,
                transition: "opacity 0.3s ease-out",
              }}
            >
              {s.left}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--accent-radar)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            fontSize: 12,
            marginBottom: 32,
          }}
        >
          RIALO
        </h3>
        <div style={{ display: "grid", gap: 12 }}>
          {STAGES.map((s, i) => (
            <div
              key={`${s.right}-${i}`}
              style={{
                padding: "14px 18px",
                border: `1px solid ${
                  s.right === "—" ? "transparent" : "var(--border-emphasis)"
                }`,
                background:
                  s.right === "—" ? "transparent" : "var(--surface-1)",
                color:
                  s.right === "—"
                    ? "var(--text-tertiary)"
                    : "var(--accent-radar)",
                fontFamily: "var(--font-mono)",
                textAlign: s.right === "—" ? "center" : "left",
                opacity: i < visibleStages ? 1 : 0.2,
                transition: "opacity 0.3s ease-out",
              }}
            >
              {s.right}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
