import { describe, it, expect, beforeEach } from "vitest";
import { useEventStore } from "../store/eventStore";

describe("eventStore", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
  });

  it("addFlare prepends to flares", () => {
    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xabc",
      settle_duration_ms: 100,
    });
    expect(useEventStore.getState().flares).toHaveLength(1);
    expect(useEventStore.getState().flares[0].flight_id).toBe(
      "BA178-20260614",
    );
  });

  it("flares capped at 100", () => {
    const { addFlare } = useEventStore.getState();
    for (let i = 0; i < 150; i++) {
      addFlare({
        flight_id: `F-${i}`,
        policy_id: `p${i}`,
        payout: 10,
        delay_minutes: 30,
        signature: `0x${i}`,
        settle_duration_ms: 100,
      });
    }
    expect(useEventStore.getState().flares).toHaveLength(100);
  });

  it("addToast and dismissToast", () => {
    useEventStore.getState().addToast({ id: "t1", message: "+10 RIA" });
    expect(useEventStore.getState().toasts).toHaveLength(1);
    useEventStore.getState().dismissToast("t1");
    expect(useEventStore.getState().toasts).toHaveLength(0);
  });

  it("setWsState transitions", () => {
    useEventStore.getState().setWsState("connecting");
    expect(useEventStore.getState().wsState).toBe("connecting");
    useEventStore.getState().setWsState("open");
    expect(useEventStore.getState().wsState).toBe("open");
  });
});
