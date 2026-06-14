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
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
