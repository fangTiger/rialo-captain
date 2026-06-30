import { useEffect } from "react";
import useSWR from "swr";
import { apiFetch } from "../api/client";
import {
  DEFAULT_DELAY_THRESHOLD_MINUTES,
  fallbackRiskLevelForStatus,
  fallbackRiskReasonForLevel,
} from "../components/hangar/risk";
import { useEventStore } from "../store/eventStore";

export type PolicyStatus = "active" | "paid" | "expired";
export type PolicyRiskLevel =
  | "triggered"
  | "watch"
  | "normal"
  | "unknown"
  | "settled"
  | "inactive";

export interface Policy {
  id: string;
  flight_id: string;
  premium: number;
  payout: number;
  status: PolicyStatus;
  contract_ref: string;
  created_at: number;
  delay_threshold_minutes?: number | null;
  live_delay_minutes?: number | null;
  minutes_until_trigger?: number | null;
  risk_level?: PolicyRiskLevel;
  risk_reason?: string | null;
}

function normalizePolicy(policy: Policy): Policy {
  const riskLevel = policy.risk_level ?? fallbackRiskLevelForStatus(policy.status);
  const delayThresholdMinutes =
    typeof policy.delay_threshold_minutes === "number"
      ? policy.delay_threshold_minutes
      : DEFAULT_DELAY_THRESHOLD_MINUTES;
  const liveDelayMinutes =
    typeof policy.live_delay_minutes === "number"
      ? policy.live_delay_minutes
      : null;
  const minutesUntilTrigger =
    typeof policy.minutes_until_trigger === "number"
      ? Math.max(0, policy.minutes_until_trigger)
      : policy.status === "active" && liveDelayMinutes !== null
        ? Math.max(0, delayThresholdMinutes - liveDelayMinutes)
        : null;

  return {
    ...policy,
    delay_threshold_minutes: delayThresholdMinutes,
    live_delay_minutes: liveDelayMinutes,
    minutes_until_trigger: minutesUntilTrigger,
    risk_level: riskLevel,
    risk_reason: policy.risk_reason ?? fallbackRiskReasonForLevel(riskLevel),
  };
}

const fetcher = async (path: string) => {
  const policies = await apiFetch<Policy[]>(path);
  return policies.map(normalizePolicy);
};

export function usePolicies() {
  const { data, error, isLoading, mutate } = useSWR<Policy[]>(
    "/policies",
    fetcher,
  );
  const flareCount = useEventStore((state) => state.flares.length);

  useEffect(() => {
    if (flareCount > 0) mutate();
  }, [flareCount, mutate]);

  return { policies: data ?? [], error, isLoading, refresh: mutate };
}
