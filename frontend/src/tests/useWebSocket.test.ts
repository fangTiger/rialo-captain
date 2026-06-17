import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useEventStore } from "../store/eventStore";

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

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("transitions to open on socket open", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = 1;
      ws.onopen?.();
    });
    expect(useEventStore.getState().wsState).toBe("open");
  });

  it("uses VITE_WS_BASE_URL when configured", () => {
    vi.stubEnv("VITE_WS_BASE_URL", "wss://api.example.com");

    renderHook(() => useWebSocket("/ws"));

    expect(MockWebSocket.instances[0].url).toBe("wss://api.example.com/ws");
  });

  it("dispatches flare events to store", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = 1;
      ws.onopen?.();
      ws.onmessage?.({
        data: JSON.stringify({
          type: "flare",
          payload: {
            flight_id: "BA178-20260614",
            policy_id: "p1",
            payout: 80,
            delay_minutes: 45,
            signature: "0xabc",
            settle_duration_ms: 100,
          },
        }),
      });
    });
    expect(useEventStore.getState().flares).toHaveLength(1);
  });

  it("records typed cinema events while preserving the legacy flare path", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onopen?.();
      ws.onmessage?.({
        data: JSON.stringify({
          type: "claim.settled",
          payload: {
            flight_id: "BA178-20260614",
            policy_id: "p1",
            payout: 80,
            delay_minutes: 45,
            signature: "0xabc",
            settle_duration_ms: 100,
            tx_hash: "0x1111111111111111111111111111111111111111",
            block_height: 1,
            source: "mock",
          },
        }),
      });
      ws.onmessage?.({
        data: JSON.stringify({
          type: "policy.created",
          payload: {
            flight_id: "DL101-20260614",
            policy_id: "p2",
            source: "real",
            created_at: 1_700_000_000_000,
          },
        }),
      });
      ws.onmessage?.({
        data: JSON.stringify({
          type: "flight.landed",
          payload: {
            flight_id: "UA200-20260614",
            policy_id: "p3",
            landed_at: 1_700_000_001,
            source: "mock",
          },
        }),
      });
      ws.onmessage?.({
        data: JSON.stringify({
          type: "flare",
          payload: {
            flight_id: "BA178-20260614",
            policy_id: "p1",
            payout: 80,
            delay_minutes: 45,
            signature: "0xabc",
            settle_duration_ms: 100,
          },
        }),
      });
    });

    const state = useEventStore.getState();
    expect(state.flares).toHaveLength(1);
    expect(state.events.map((event) => event.type)).toEqual([
      "flare",
      "flight.landed",
      "policy.created",
      "claim.settled",
    ]);
    expect(state.events[0].payload).toMatchObject({
      flight_id: "BA178-20260614",
      policy_id: "p1",
    });
  });

  it("dispatches toast events to store", () => {
    renderHook(() => useWebSocket("/ws"));
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onopen?.();
      ws.onmessage?.({
        data: JSON.stringify({ type: "toast", payload: "+10 RIA" }),
      });
    });
    expect(useEventStore.getState().toasts).toHaveLength(1);
  });
});
