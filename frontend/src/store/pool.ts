import { create } from "zustand";
import type { Pool, PoolRule } from "../api/pool";

export type PoolWsEventType =
  | "pool.opened"
  | "pool.policy_bound"
  | "pool.claim_paid"
  | "pool.rule_updated"
  | "pool.closed";

export type PoolTickerType = "opened" | "bound" | "paid" | "rule" | "closed";

export interface PoolTickerEvent {
  id: string;
  type: PoolTickerType;
  label: string;
  amount?: number;
  flightId?: string;
  policyId?: string;
  tone: "neutral" | "positive" | "warning";
  payload: Record<string, unknown>;
  receivedAt: number;
}

interface PoolStore {
  activePool: Pool | null;
  underwrittenFlightIds: Set<string>;
  ticker: PoolTickerEvent[];
  exposure: number;
  hits24h: number;
  paidOut: number;
  closedFlashUntil: number;
  setActivePool: (pool: Pool | null) => void;
  clearPool: () => void;
  resetPoolState: () => void;
  applyPoolEvent: (type: PoolWsEventType, payload: Record<string, unknown>) => void;
}

const TICKER_CAP = 80;
const POOL_CLOSED_FLASH_MS = 1000;

export const POOL_EVENT_TYPES = new Set<PoolWsEventType>([
  "pool.opened",
  "pool.policy_bound",
  "pool.claim_paid",
  "pool.rule_updated",
  "pool.closed",
]);

function makeTickerId(type: PoolTickerType) {
  return `pool-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRule(value: unknown): value is PoolRule {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule.delay_threshold_min === "number" &&
    typeof rule.payout_multiplier === "number" &&
    typeof rule.include_hubs === "boolean" &&
    typeof rule.exclude_thunderstorm === "boolean" &&
    typeof rule.cover_red_eye === "boolean"
  );
}

function eventPoolId(payload: Record<string, unknown>) {
  return typeof payload.pool_id === "string" ? payload.pool_id : null;
}

function shouldApplyToActivePool(pool: Pool | null, payload: Record<string, unknown>) {
  const poolId = eventPoolId(payload);
  return poolId === null || pool === null || pool.id === poolId;
}

function withTicker(
  ticker: PoolTickerEvent[],
  event: Omit<PoolTickerEvent, "id" | "receivedAt">,
) {
  return [
    {
      ...event,
      id: makeTickerId(event.type),
      receivedAt: Date.now(),
    },
    ...ticker,
  ].slice(0, TICKER_CAP);
}

function initialState() {
  return {
    activePool: null,
    underwrittenFlightIds: new Set<string>(),
    ticker: [],
    exposure: 0,
    hits24h: 0,
    paidOut: 0,
    closedFlashUntil: 0,
  };
}

export const usePoolStore = create<PoolStore>((set) => ({
  ...initialState(),
  setActivePool: (pool) =>
    set({
      activePool: pool,
      underwrittenFlightIds: new Set(),
      exposure: 0,
      hits24h: 0,
      paidOut: 0,
      closedFlashUntil: 0,
    }),
  clearPool: () =>
    set({
      activePool: null,
      underwrittenFlightIds: new Set(),
      exposure: 0,
      hits24h: 0,
    }),
  resetPoolState: () => set(initialState()),
  applyPoolEvent: (type, payload) =>
    set((state) => {
      if (!shouldApplyToActivePool(state.activePool, payload)) return state;

      if (type === "pool.opened") {
        return {
          ticker: withTicker(state.ticker, {
            type: "opened",
            label: "You → Pool · stake locked",
            amount: numberValue(payload.stake_ria),
            tone: "positive",
            payload,
          }),
        };
      }

      if (type === "pool.policy_bound") {
        const flightId = textValue(payload.flight_id, "");
        const callsign = textValue(payload.callsign, "flight");
        const premium = numberValue(payload.premium);
        const exposureAfter = numberValue(payload.exposure_after) ?? state.exposure;
        const underwrittenFlightIds = new Set(state.underwrittenFlightIds);
        if (flightId) underwrittenFlightIds.add(flightId);
        if (callsign) underwrittenFlightIds.add(callsign);

        return {
          underwrittenFlightIds,
          hits24h: state.hits24h + 1,
          exposure: exposureAfter,
          activePool: state.activePool
            ? {
                ...state.activePool,
                balance: state.activePool.balance + (premium ?? 0),
                pl: state.activePool.balance + (premium ?? 0) - state.activePool.stake_ria,
              }
            : state.activePool,
          ticker: withTicker(state.ticker, {
            type: "bound",
            label: `Passenger → Pool · ${callsign}`,
            amount: premium,
            flightId: flightId || undefined,
            policyId: textValue(payload.policy_id, ""),
            tone: "positive",
            payload,
          }),
        };
      }

      if (type === "pool.claim_paid") {
        const flightId = textValue(payload.flight_id, "");
        const callsign = textValue(payload.callsign, "flight");
        const payout = numberValue(payload.payout) ?? 0;
        const balanceAfter = numberValue(payload.balance_after);
        const pl = numberValue(payload.pl);

        return {
          paidOut: state.paidOut + payout,
          activePool: state.activePool
            ? {
                ...state.activePool,
                balance: balanceAfter ?? state.activePool.balance - payout,
                pl: pl ?? state.activePool.pl - payout,
              }
            : state.activePool,
          ticker: withTicker(state.ticker, {
            type: "paid",
            label: `Pool → Passenger · ${callsign} ⛓︎ auto-settled`,
            amount: payout,
            flightId: flightId || undefined,
            policyId: textValue(payload.policy_id, ""),
            tone: "warning",
            payload,
          }),
        };
      }

      if (type === "pool.rule_updated" && isRule(payload.new_rule)) {
        return {
          activePool: state.activePool
            ? {
                ...state.activePool,
                rule: payload.new_rule,
              }
            : state.activePool,
          ticker: withTicker(state.ticker, {
            type: "rule",
            label: "Reactive contract updated",
            tone: "neutral",
            payload,
          }),
        };
      }

      if (type === "pool.closed") {
        return {
          activePool: null,
          underwrittenFlightIds: new Set<string>(),
          exposure: 0,
          hits24h: 0,
          closedFlashUntil: Date.now() + POOL_CLOSED_FLASH_MS,
          ticker: withTicker(state.ticker, {
            type: "closed",
            label:
              payload.reason === "bankrupt"
                ? "Pool empty · closed by drawdown"
                : "Pool → You · stake returned",
            amount: numberValue(payload.final_pl),
            tone: "warning",
            payload,
          }),
        };
      }

      return state;
    }),
}));
