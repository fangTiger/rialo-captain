import type { PoolRule } from "../../api/pool";
import { RuleChipEditor } from "./RuleChipEditor";

interface RuleLineProps {
  rule: PoolRule;
  onChange: (rule: PoolRule) => void;
}

function multiplierLabel(value: number) {
  return `${value.toFixed(1)}x payout`;
}

export function RuleLine({ rule, onChange }: RuleLineProps) {
  return (
    <div
      aria-label="Pool rule"
      role="group"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
      }}
    >
      <RuleChipEditor
        buttonLabel="Edit delay threshold"
        field="delay_threshold_min"
        inputLabel="Delay threshold"
        rule={rule}
        tone="weather"
        onChange={onChange}
      >
        Delay at least {rule.delay_threshold_min}m
      </RuleChipEditor>
      <RuleChipEditor
        buttonLabel="Edit payout multiplier"
        field="payout_multiplier"
        inputLabel="Payout multiplier"
        rule={rule}
        tone="radar"
        onChange={onChange}
      >
        {multiplierLabel(rule.payout_multiplier)}
      </RuleChipEditor>
      <RuleChipEditor
        buttonLabel="Edit hub coverage"
        field="include_hubs"
        inputLabel="Include hub routes"
        rule={rule}
        tone="guarded"
        onChange={onChange}
      >
        {rule.include_hubs ? "Hubs included" : "Hubs filtered"}
      </RuleChipEditor>
      <RuleChipEditor
        buttonLabel="Edit storm coverage"
        field="exclude_thunderstorm"
        inputLabel="Exclude thunderstorms"
        rule={rule}
        tone={rule.exclude_thunderstorm ? "low" : "elevated"}
        onChange={onChange}
      >
        {rule.exclude_thunderstorm ? "Storms excluded" : "Storms covered"}
      </RuleChipEditor>
      <RuleChipEditor
        buttonLabel="Edit red-eye coverage"
        field="cover_red_eye"
        inputLabel="Cover red-eye flights"
        rule={rule}
        tone={rule.cover_red_eye ? "weather" : "neutral"}
        onChange={onChange}
      >
        {rule.cover_red_eye ? "Red-eye covered" : "Red-eye off"}
      </RuleChipEditor>
    </div>
  );
}
