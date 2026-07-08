import { apiFetch } from "./client";

export type PoolStatus = "active" | "closed_by_user" | "closed_bankrupt";
export type PresetStyle = "steady" | "storm" | "hub" | "custom";

export interface PoolRule {
  delay_threshold_min: number;
  payout_multiplier: number;
  include_hubs: boolean;
  exclude_thunderstorm: boolean;
  cover_red_eye: boolean;
}

export interface Pool {
  id: string;
  user_id: string;
  preset_style: PresetStyle;
  status: PoolStatus;
  stake_ria: number;
  balance: number;
  pl: number;
  rule: PoolRule;
  created_at: string;
  closed_at?: string | null;
}

export interface PoolEvent {
  id: string;
  pool_id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface OpenPoolInput extends PoolRule {
  preset_style: PresetStyle;
  stake_ria: number;
}

export type PatchPoolInput = Partial<PoolRule>;

export interface ClosePoolResponse {
  pool: Pool;
  returned_balance: number;
}

export function openPool(input: OpenPoolInput) {
  return apiFetch<Pool>("/pools", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getMyPool() {
  return apiFetch<Pool | null>("/pools/me");
}

export function patchPool(poolId: string, input: PatchPoolInput) {
  return apiFetch<Pool>(`/pools/${poolId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function closePool(poolId: string) {
  return apiFetch<ClosePoolResponse>(`/pools/${poolId}`, {
    method: "DELETE",
  });
}

export function getPoolTimeline(poolId: string, limit = 50) {
  return apiFetch<PoolEvent[]>(`/pools/${poolId}/timeline?limit=${limit}`);
}
