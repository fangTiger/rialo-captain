import { useEffect, useState, type ReactNode } from "react";
import type { PoolRule } from "../../api/pool";
import type { CommandTone } from "../../design/commandCenter";

type RuleValue = number | boolean;

interface RuleChipEditorProps {
  buttonLabel: string;
  children: ReactNode;
  field: keyof PoolRule;
  inputLabel: string;
  rule: PoolRule;
  tone?: CommandTone;
  onChange: (rule: PoolRule) => void;
}

function toneClass(tone: CommandTone) {
  return tone === "neutral" ? "" : ` risk-level--${tone}`;
}

function clampNumber(field: keyof PoolRule, value: number) {
  if (field === "delay_threshold_min") return Math.max(5, Math.min(180, Math.round(value)));
  if (field === "payout_multiplier") return Math.max(1, Math.min(10, value));
  return value;
}

export function RuleChipEditor({
  buttonLabel,
  children,
  field,
  inputLabel,
  rule,
  tone = "radar",
  onChange,
}: RuleChipEditorProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RuleValue>(rule[field]);

  useEffect(() => {
    if (open) setDraft(rule[field]);
  }, [field, open, rule]);

  const isBoolean = typeof rule[field] === "boolean";

  return (
    <span
      style={{
        display: "inline-grid",
        gap: 8,
        position: "relative",
      }}
    >
      <button
        aria-label={buttonLabel}
        className={`signal-pill signal-pill--${tone}${toneClass(tone)} command-focus-ring`}
        onClick={() => setOpen((current) => !current)}
        style={{
          borderRadius: "var(--radius-pill)",
          cursor: "pointer",
        }}
        type="button"
      >
        {children}
      </button>
      {open ? (
        <span
          aria-label={buttonLabel}
          role="dialog"
          style={{
            display: "grid",
            gap: 10,
            minWidth: 220,
            padding: 12,
            color: "var(--text-primary)",
            background: "var(--command-surface-raised)",
            border: "1px solid var(--command-border-strong)",
            borderRadius: "var(--radius-soft)",
            boxShadow: "var(--glow-command)",
            zIndex: 5,
          }}
        >
          {isBoolean ? (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--text-primary)",
                fontSize: "var(--font-size-body)",
              }}
            >
              <input
                checked={Boolean(draft)}
                onChange={(event) => setDraft(event.currentTarget.checked)}
                type="checkbox"
              />
              {inputLabel}
            </label>
          ) : (
            <label
              style={{
                display: "grid",
                gap: 6,
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-caption)",
              }}
            >
              {inputLabel}
              <input
                aria-label={inputLabel}
                max={field === "delay_threshold_min" ? 180 : 10}
                min={field === "delay_threshold_min" ? 5 : 1}
                onChange={(event) => setDraft(Number(event.currentTarget.value))}
                step={field === "delay_threshold_min" ? 5 : 0.5}
                style={{
                  color: "var(--text-primary)",
                  background: "var(--command-surface-inset)",
                  border: "1px solid var(--command-border)",
                  borderRadius: "var(--radius-sharp)",
                  padding: "8px 10px",
                  fontFamily: "var(--font-mono)",
                }}
                type="number"
                value={Number(draft)}
              />
            </label>
          )}
          <button
            className="command-focus-ring"
            onClick={() => {
              const nextValue =
                typeof draft === "number" ? clampNumber(field, draft) : draft;
              onChange({
                ...rule,
                [field]: nextValue,
              });
              setOpen(false);
            }}
            style={{
              justifySelf: "start",
              minHeight: 32,
              padding: "0 12px",
              color: "var(--surface-0)",
              background: "var(--accent-radar)",
              border: "1px solid var(--accent-radar)",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-mono)",
              fontSize: "var(--font-size-caption)",
              cursor: "pointer",
            }}
            type="button"
          >
            Apply
          </button>
        </span>
      ) : null}
    </span>
  );
}
