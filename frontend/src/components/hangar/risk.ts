import type {
  Policy,
  PolicyRiskLevel,
  PolicyStatus,
} from "../../hooks/usePolicies";

export const DEFAULT_DELAY_THRESHOLD_MINUTES = 30;

export interface HangarSummary {
  activeExposure: number;
  maxPotentialPayout: number;
  settledPayout: number;
  atRiskCount: number;
}

const ACTIVE_RISK_PRIORITY: Record<PolicyRiskLevel, number> = {
  triggered: 0,
  watch: 1,
  unknown: 2,
  normal: 3,
  settled: 4,
  inactive: 5,
};

export function fallbackRiskLevelForStatus(status: PolicyStatus): PolicyRiskLevel {
  if (status === "paid") return "settled";
  if (status === "expired") return "inactive";
  return "unknown";
}

export function fallbackRiskReasonForLevel(level: PolicyRiskLevel): string {
  switch (level) {
    case "triggered":
      return "Delay crossed trigger threshold.";
    case "watch":
      return "Delay sits inside the watch band.";
    case "normal":
      return "Delay remains below watch band.";
    case "settled":
      return "Policy already settled.";
    case "inactive":
      return "Coverage expired before trigger.";
    case "unknown":
    default:
      return "Live signal unavailable.";
  }
}

export function getPolicyRiskLevel(
  policy: Pick<Policy, "status" | "risk_level">,
): PolicyRiskLevel {
  return policy.risk_level ?? fallbackRiskLevelForStatus(policy.status);
}

export function getPolicyDelayThresholdMinutes(
  policy: Pick<Policy, "delay_threshold_minutes">,
): number {
  return typeof policy.delay_threshold_minutes === "number"
    ? policy.delay_threshold_minutes
    : DEFAULT_DELAY_THRESHOLD_MINUTES;
}

export function getPolicyLiveDelayMinutes(
  policy: Pick<Policy, "live_delay_minutes">,
): number | null {
  return typeof policy.live_delay_minutes === "number"
    ? policy.live_delay_minutes
    : null;
}

export function getPolicyMinutesUntilTrigger(
  policy: Pick<
    Policy,
    | "status"
    | "minutes_until_trigger"
    | "live_delay_minutes"
    | "delay_threshold_minutes"
  >,
): number | null {
  if (policy.status !== "active") return null;
  if (typeof policy.minutes_until_trigger === "number") {
    return Math.max(0, policy.minutes_until_trigger);
  }

  const liveDelayMinutes = getPolicyLiveDelayMinutes(policy);
  if (liveDelayMinutes === null) return null;

  return Math.max(
    0,
    getPolicyDelayThresholdMinutes(policy) - liveDelayMinutes,
  );
}

export function getPolicyRiskReason(
  policy: Pick<Policy, "status" | "risk_level" | "risk_reason">,
): string {
  if (typeof policy.risk_reason === "string" && policy.risk_reason.length > 0) {
    return policy.risk_reason;
  }

  return fallbackRiskReasonForLevel(getPolicyRiskLevel(policy));
}

export function isAtRiskPolicy(
  policy: Pick<Policy, "status" | "risk_level">,
): boolean {
  if (policy.status !== "active") return false;
  const level = getPolicyRiskLevel(policy);
  return level === "triggered" || level === "watch";
}

export function summarizeHangarPolicies(policies: Policy[]): HangarSummary {
  return policies.reduce<HangarSummary>(
    (summary, policy) => {
      if (policy.status === "active") {
        summary.activeExposure += policy.premium;
        summary.maxPotentialPayout += policy.payout;
        if (isAtRiskPolicy(policy)) {
          summary.atRiskCount += 1;
        }
      }

      if (policy.status === "paid") {
        summary.settledPayout += policy.payout;
      }

      return summary;
    },
    {
      activeExposure: 0,
      maxPotentialPayout: 0,
      settledPayout: 0,
      atRiskCount: 0,
    },
  );
}

export function sortActivePolicies(policies: Policy[]): Policy[] {
  return [...policies].sort((left, right) => {
    const riskDelta =
      ACTIVE_RISK_PRIORITY[getPolicyRiskLevel(left)] -
      ACTIVE_RISK_PRIORITY[getPolicyRiskLevel(right)];
    if (riskDelta !== 0) return riskDelta;

    const payoutDelta = right.payout - left.payout;
    if (payoutDelta !== 0) return payoutDelta;

    return right.created_at - left.created_at;
  });
}
