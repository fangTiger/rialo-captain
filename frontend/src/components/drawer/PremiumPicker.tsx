interface Props {
  value: number;
  onChange: (v: number) => void;
}

const TIERS = [5, 10, 20] as const;

export function PremiumPicker({ value, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {TIERS.map((tier) => {
        const active = value === tier;
        return (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            style={{
              flex: 1,
              padding: "12px 16px",
              border: `1px solid ${
                active ? "var(--accent-radar)" : "var(--border-subtle)"
              }`,
              background: active
                ? "rgba(0, 255, 157, 0.08)"
                : "var(--surface-2)",
              color: active ? "var(--accent-radar)" : "var(--text-primary)",
              borderRadius: "var(--radius-sharp)",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              letterSpacing: "0.18em",
            }}
          >
            {tier} RIA
          </button>
        );
      })}
    </div>
  );
}
