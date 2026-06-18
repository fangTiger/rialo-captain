import { describe, it, expect, beforeEach } from "vitest";
import { useEventStore } from "../store/eventStore";

describe("eventStore", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
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

  it("deduplicates repeated flare payloads", () => {
    const flare = {
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xabc",
      settle_duration_ms: 100,
    };

    useEventStore.getState().addFlare(flare);
    useEventStore.getState().addFlare({ ...flare });

    expect(useEventStore.getState().flares).toHaveLength(1);
  });

  it("deduplicates repeated flares by policy id", () => {
    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xfallback",
      settle_duration_ms: 100,
    });
    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xbackend",
      settle_duration_ms: 120,
    });

    expect(useEventStore.getState().flares).toHaveLength(1);
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

  it("addEvent prepends typed cinema events and caps the ring buffer", () => {
    const { addEvent } = useEventStore.getState();
    for (let i = 0; i < 250; i++) {
      addEvent({
        id: `e-${i}`,
        type: "policy.created",
        payload: {
          flight_id: `F-${i}`,
          policy_id: `p${i}`,
          source: "real",
        },
        receivedAt: i,
      });
    }

    const events = useEventStore.getState().events;
    expect(events).toHaveLength(200);
    expect(events[0]).toMatchObject({
      id: "e-249",
      type: "policy.created",
      receivedAt: 249,
    });
    expect(events[events.length - 1]).toMatchObject({ id: "e-50" });
  });

  it("deduplicates repeated typed cinema event payloads", () => {
    const event = {
      type: "claim.settled" as const,
      payload: {
        flight_id: "BA178-20260614",
        policy_id: "p1",
        payout: 80,
        delay_minutes: 45,
        tx_hash: "0x1111111111111111111111111111111111111111",
        source: "mock",
      },
    };

    useEventStore.getState().addEvent(event);
    useEventStore.getState().addEvent({ ...event, payload: { ...event.payload } });

    expect(useEventStore.getState().events).toHaveLength(1);
  });

  it("deduplicates typed cinema events by type and policy id", () => {
    useEventStore.getState().addEvent({
      type: "claim.settled",
      payload: {
        flight_id: "BA178-20260614",
        policy_id: "p1",
        payout: 80,
        delay_minutes: 45,
        tx_hash: "0xfallback",
        source: "real-fallback",
      },
    });
    useEventStore.getState().addEvent({
      type: "claim.settled",
      payload: {
        flight_id: "BA178-20260614",
        policy_id: "p1",
        payout: 80,
        delay_minutes: 45,
        tx_hash: "0xbackend",
        block_height: 9001,
        source: "mock",
      },
    });

    expect(useEventStore.getState().events).toHaveLength(1);
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
