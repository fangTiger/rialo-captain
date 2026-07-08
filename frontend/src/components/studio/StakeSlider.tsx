import type { PoolRule } from "../../api/pool";
import { MetricDeck } from "../../design/commandCenter";

interface StakeSliderProps {
  rule: PoolRule;
  stake: number;
  canOpen: boolean;
  isOpening?: boolean;
  onStakeChange: (stake: number) => void;
  onOpen: () => void;
}

export function estimatePoolOutlook(rule: PoolRule, stake: number) {
  const stakeFactor = Math.max(0.5, stake / 200);
  const hubFactor = rule.include_hubs ? 1.15 : 0.75;
  const stormFactor = rule.exclude_thunderstorm ? 0.72 : 1.28;
  const redEyeFactor = rule.cover_red_eye ? 1.12 : 0.92;
  const delayFactor = Math.max(0.35, Math.min(1.4, 30 / rule.delay_threshold_min));
  const expectedHits7d = Math.max(
    1,
    Math.round(9 * stakeFactor * hubFactor * stormFactor * redEyeFactor * delayFactor),
  );
  const expectedPremium = expectedHits7d * 10;
  const expectedPayout = expectedHits7d * rule.payout_multiplier * (4 / 3);
  const expectedPl7d = Math.round(expectedPremium - expectedPayout);

  return { expectedHits7d, expectedPl7d };
}

function formatPl(value: number) {
  if (value > 0) return `+${value} RIA`;
  if (value < 0) return `${value} RIA`;
  return "0 RIA";
}

export function StakeSlider({
  rule,
  stake,
  canOpen,
  isOpening = false,
  onStakeChange,
  onOpen,
}: StakeSliderProps) {
  const outlook = estimatePoolOutlook(rule, stake);

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--layout-panel-gap)",
      }}
    >
      <label
        style={{
          display: "grid",
          gap: 8,
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--font-size-caption)",
          textTransform: "uppercase",
        }}
      >
        <span>Stake {stake} RIA</span>
        <input
          aria-label="Stake"
          max={1000}
          min={50}
          onChange={(event) => onStakeChange(Number(event.currentTarget.value))}
          step={50}
          type="range"
          value={stake}
        />
      </label>
      <MetricDeck
        ariaLabel="Expected pool outlook"
        metrics={[
          {
            id: "hits",
            label: "Expected 7d hits",
            value: outlook.expectedHits7d,
            detail: "Preset baseline",
            tone: "weather",
          },
          {
            id: "pl",
            label: "Expected 7d P/L",
            value: formatPl(outlook.expectedPl7d),
            detail: "Premium minus modeled payout",
            tone: outlook.expectedPl7d >= 0 ? "radar" : "elevated",
          },
        ]}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: canOpen ? "var(--text-secondary)" : "var(--warn-amber)",
            fontSize: "var(--font-size-caption)",
          }}
        >
          {canOpen ? "Ready to underwrite forward demand" : "Balance required before opening"}
        </span>
        <button
          className="command-focus-ring"
          disabled={!canOpen || isOpening}
          onClick={onOpen}
          style={{
            minHeight: 40,
            padding: "0 16px",
            color: "var(--surface-0)",
            background: "var(--accent-radar)",
            border: "1px solid var(--accent-radar)",
            borderRadius: "var(--radius-pill)",
            cursor: canOpen && !isOpening ? "pointer" : "not-allowed",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--font-size-caption)",
            textTransform: "uppercase",
            opacity: canOpen && !isOpening ? 1 : 0.56,
          }}
          type="button"
        >
          {isOpening ? "OPENING" : "OPEN POOL ▸"}
        </button>
      </div>
    </div>
  );
}
