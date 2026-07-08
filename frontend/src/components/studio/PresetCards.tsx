import type { PoolRule, PresetStyle } from "../../api/pool";
import { SignalPill } from "../../design/commandCenter";

export interface StudioPresetDefinition {
  id: PresetStyle;
  name: string;
  summary: string;
  rule: PoolRule;
}

export const STUDIO_PRESETS: StudioPresetDefinition[] = [
  {
    id: "steady",
    name: "Steady Skies",
    summary: "Lower variance, cleaner weather, steady premium flow.",
    rule: {
      delay_threshold_min: 30,
      payout_multiplier: 3,
      include_hubs: true,
      exclude_thunderstorm: true,
      cover_red_eye: false,
    },
  },
  {
    id: "storm",
    name: "Storm Chaser",
    summary: "Accept storm risk for higher forward yield.",
    rule: {
      delay_threshold_min: 30,
      payout_multiplier: 5,
      include_hubs: true,
      exclude_thunderstorm: false,
      cover_red_eye: true,
    },
  },
  {
    id: "hub",
    name: "Hub Hunter",
    summary: "Concentrate on major corridors with tight exposure.",
    rule: {
      delay_threshold_min: 30,
      payout_multiplier: 2,
      include_hubs: true,
      exclude_thunderstorm: true,
      cover_red_eye: true,
    },
  },
];

interface PresetCardsProps {
  selectedPreset: PresetStyle;
  onPresetChange: (preset: Pick<StudioPresetDefinition, "id" | "name" | "rule">) => void;
}

function multiplierLabel(rule: PoolRule) {
  return `${rule.payout_multiplier.toFixed(1)}x payout`;
}

function stormLabel(rule: PoolRule) {
  return rule.exclude_thunderstorm ? "Storms excluded" : "Storms covered";
}

function redEyeLabel(rule: PoolRule) {
  return rule.cover_red_eye ? "Red-eye covered" : "Red-eye off";
}

export function PresetCards({ selectedPreset, onPresetChange }: PresetCardsProps) {
  return (
    <div
      aria-label="Underwriter presets"
      role="group"
      style={{
        display: "grid",
        gap: "var(--layout-panel-gap)",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))",
      }}
    >
      {STUDIO_PRESETS.map((preset) => {
        const selected = selectedPreset === preset.id;

        return (
          <button
            aria-pressed={selected}
            className="command-focus-ring"
            key={preset.id}
            onClick={() =>
              onPresetChange({
                id: preset.id,
                name: preset.name,
                rule: preset.rule,
              })
            }
            style={{
              display: "grid",
              gap: 10,
              minHeight: 178,
              padding: 16,
              color: "var(--text-primary)",
              background: selected
                ? "var(--command-surface-raised)"
                : "var(--command-surface-glass)",
              border: selected
                ? "1px solid var(--command-border-strong)"
                : "1px solid var(--command-border)",
              borderRadius: "var(--radius-soft)",
              boxShadow: selected ? "var(--glow-radar)" : "var(--elev-1)",
              textAlign: "left",
              cursor: "pointer",
            }}
            type="button"
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--font-size-hud)",
                  lineHeight: "var(--line-height-tight)",
                }}
              >
                {preset.name}
              </span>
              {selected ? <SignalPill label="Selected preset">LIVE</SignalPill> : null}
            </span>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "var(--font-size-body)",
                lineHeight: "var(--line-height-copy)",
              }}
            >
              {preset.summary}
            </span>
            <span
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <SignalPill tone="weather" label={`${preset.name} delay threshold`}>
                {preset.rule.delay_threshold_min}m delay
              </SignalPill>
              <SignalPill tone="radar" label={`${preset.name} payout multiplier`}>
                {multiplierLabel(preset.rule)}
              </SignalPill>
              <SignalPill tone="guarded" label={`${preset.name} hub rule`}>
                Hubs included
              </SignalPill>
              <SignalPill tone={preset.rule.exclude_thunderstorm ? "low" : "elevated"}>
                {stormLabel(preset.rule)}
              </SignalPill>
              <SignalPill tone={preset.rule.cover_red_eye ? "weather" : "neutral"}>
                {redEyeLabel(preset.rule)}
              </SignalPill>
            </span>
          </button>
        );
      })}
    </div>
  );
}
