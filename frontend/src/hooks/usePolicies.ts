import { useEffect, useMemo, useState } from "react";
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

interface StoredRecentPolicy {
  policy: Policy;
  recordedAt: number;
}

const RECENT_POLICIES_STORAGE_KEY = "rialo:recent-purchased-policies:v1";
const RECENT_POLICIES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const RECENT_POLICIES_LIMIT = 25;
const recentPolicyListeners = new Set<() => void>();

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

function isPolicyStatus(value: unknown): value is PolicyStatus {
  return value === "active" || value === "paid" || value === "expired";
}

function isPolicyRiskLevel(value: unknown): value is PolicyRiskLevel {
  return (
    value === "triggered" ||
    value === "watch" ||
    value === "normal" ||
    value === "unknown" ||
    value === "settled" ||
    value === "inactive"
  );
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function policyFromUnknown(value: unknown): Policy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = stringValue(record.id);
  const flightId = stringValue(record.flight_id);
  const premium = numberOrNull(record.premium);
  const payout = numberOrNull(record.payout);
  const status = record.status;
  const contractRef = stringValue(record.contract_ref);
  const createdAt = numberOrNull(record.created_at);
  if (
    !id ||
    !flightId ||
    premium === null ||
    payout === null ||
    !isPolicyStatus(status) ||
    !contractRef ||
    createdAt === null
  ) {
    return null;
  }

  return normalizePolicy({
    id,
    flight_id: flightId,
    premium,
    payout,
    status,
    contract_ref: contractRef,
    created_at: createdAt,
    delay_threshold_minutes: numberOrNull(record.delay_threshold_minutes),
    live_delay_minutes: numberOrNull(record.live_delay_minutes),
    minutes_until_trigger: numberOrNull(record.minutes_until_trigger),
    risk_level: isPolicyRiskLevel(record.risk_level)
      ? record.risk_level
      : undefined,
    risk_reason:
      typeof record.risk_reason === "string" ? record.risk_reason : null,
  });
}

function storageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRecentPolicyRecords(now = Date.now()): StoredRecentPolicy[] {
  const storage = storageOrNull();
  if (!storage) return [];
  const raw = storage.getItem(RECENT_POLICIES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): StoredRecentPolicy | null => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const record = item as Record<string, unknown>;
        const recordedAt = numberOrNull(record.recordedAt);
        const policy = policyFromUnknown(record.policy);
        if (recordedAt === null || policy === null) return null;
        if (now - recordedAt > RECENT_POLICIES_MAX_AGE_MS) return null;
        return { policy, recordedAt };
      })
      .filter((item): item is StoredRecentPolicy => item !== null)
      .slice(0, RECENT_POLICIES_LIMIT);
  } catch {
    return [];
  }
}

function writeRecentPolicyRecords(records: StoredRecentPolicy[]) {
  const storage = storageOrNull();
  if (!storage) return;
  storage.setItem(
    RECENT_POLICIES_STORAGE_KEY,
    JSON.stringify(records.slice(0, RECENT_POLICIES_LIMIT)),
  );
}

function notifyRecentPolicyListeners() {
  for (const listener of recentPolicyListeners) listener();
}

function useRecentPurchasedPolicies() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const listener = () => setVersion((current) => current + 1);
    recentPolicyListeners.add(listener);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === RECENT_POLICIES_STORAGE_KEY) listener();
    };
    window.addEventListener("storage", handleStorage);
    return () => {
      recentPolicyListeners.delete(listener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return useMemo(() => {
    void version;
    return readRecentPolicyRecords().map((record) => record.policy);
  }, [version]);
}

function mergeRecentPolicies(serverPolicies: Policy[], recentPolicies: Policy[]) {
  const serverIds = new Set(serverPolicies.map((policy) => policy.id));
  const missingRecent = recentPolicies.filter((policy) => !serverIds.has(policy.id));
  missingRecent.sort((left, right) => right.created_at - left.created_at);
  return [...missingRecent, ...serverPolicies];
}

export function recordRecentPurchasedPolicy(policy: Policy) {
  const normalizedPolicy = normalizePolicy(policy);
  const existing = readRecentPolicyRecords();
  writeRecentPolicyRecords([
    { policy: normalizedPolicy, recordedAt: Date.now() },
    ...existing.filter((item) => item.policy.id !== normalizedPolicy.id),
  ]);
  notifyRecentPolicyListeners();
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
  const recentPolicies = useRecentPurchasedPolicies();
  const policies = useMemo(
    () => mergeRecentPolicies(data ?? [], recentPolicies),
    [data, recentPolicies],
  );

  useEffect(() => {
    if (flareCount > 0) mutate();
  }, [flareCount, mutate]);

  return { policies, error, isLoading, refresh: mutate };
}
