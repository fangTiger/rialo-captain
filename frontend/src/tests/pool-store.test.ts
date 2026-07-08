import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "../hooks/useWebSocket";
import { usePoolStore, type PoolTickerEvent } from "../store/pool";
import { renderHook } from "@testing-library/react";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  readyState = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send() {}

  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const basePool = {
  id: "pool-1",
  user_id: "user-1",
  preset_style: "steady" as const,
  status: "active" as const,
  stake_ria: 200,
  balance: 200,
  pl: 0,
  rule: {
    delay_threshold_min: 30,
    payout_multiplier: 3,
    include_hubs: true,
    exclude_thunderstorm: true,
    cover_red_eye: false,
  },
  created_at: "2026-07-08T00:00:00Z",
  closed_at: null,
};

function latestTicker(): PoolTickerEvent {
  const event = usePoolStore.getState().ticker[0];
  if (!event) throw new Error("Missing ticker event.");
  return event;
}

describe("pool store", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    usePoolStore.getState().resetPoolState();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  it("updates active pool metrics and ticker from pool events", () => {
    usePoolStore.getState().setActivePool(basePool);

    act(() => {
      usePoolStore.getState().applyPoolEvent("pool.policy_bound", {
        pool_id: "pool-1",
        policy_id: "policy-1",
        flight_id: "flight-1",
        callsign: "AA100",
        premium: 10,
        exposure_after: 90,
      });
    });

    expect(usePoolStore.getState().underwrittenFlightIds.has("flight-1")).toBe(true);
    expect(usePoolStore.getState().hits24h).toBe(1);
    expect(usePoolStore.getState().exposure).toBe(90);
    expect(usePoolStore.getState().activePool?.balance).toBe(210);
    expect(latestTicker()).toMatchObject({
      type: "bound",
      label: "Passenger → Pool · AA100",
      amount: 10,
    });

    act(() => {
      usePoolStore.getState().applyPoolEvent("pool.claim_paid", {
        pool_id: "pool-1",
        policy_id: "policy-1",
        flight_id: "flight-1",
        callsign: "AA100",
        payout: 80,
        balance_after: 130,
        pl: -70,
      });
    });

    expect(usePoolStore.getState().paidOut).toBe(80);
    expect(usePoolStore.getState().activePool).toMatchObject({
      balance: 130,
      pl: -70,
    });
    expect(latestTicker()).toMatchObject({
      type: "paid",
      label: "Pool → Passenger · AA100 ⛓︎ auto-settled",
      amount: 80,
    });
  });

  it("routes pool websocket events into the pool store", () => {
    usePoolStore.getState().setActivePool(basePool);
    renderHook(() => useWebSocket("/ws"));

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onopen?.();
      ws.onmessage?.({
        data: JSON.stringify({
          type: "pool.policy_bound",
          payload: {
            pool_id: "pool-1",
            policy_id: "policy-2",
            flight_id: "flight-2",
            callsign: "DL200",
            premium: 20,
            exposure_after: 120,
          },
        }),
      });
      ws.onmessage?.({
        data: JSON.stringify({
          type: "pool.rule_updated",
          payload: {
            pool_id: "pool-1",
            new_rule: {
              delay_threshold_min: 45,
              payout_multiplier: 2,
              include_hubs: true,
              exclude_thunderstorm: false,
              cover_red_eye: true,
            },
          },
        }),
      });
    });

    expect(usePoolStore.getState().underwrittenFlightIds.has("flight-2")).toBe(true);
    expect(usePoolStore.getState().activePool?.rule).toMatchObject({
      delay_threshold_min: 45,
      payout_multiplier: 2,
      exclude_thunderstorm: false,
      cover_red_eye: true,
    });
    expect(usePoolStore.getState().ticker[0]).toMatchObject({
      type: "rule",
      label: "Reactive contract updated",
    });
  });
});
