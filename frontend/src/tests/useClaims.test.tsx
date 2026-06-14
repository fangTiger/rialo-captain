import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useClaims } from "../hooks/useClaims";
import { useEventStore } from "../store/eventStore";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("useClaims", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("merges recent claims with current FLARE events and deduplicates by signature", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "c-persisted",
            policy_id: "policy-persisted",
            payout: 80,
            delay_minutes: 45,
            signature: "0xpersisted",
            settled_at: 1_800_000_000,
            settle_duration_ms: 118,
          },
        ]),
        { status: 200 },
      ),
    );

    act(() => {
      useEventStore.getState().addFlare({
        flight_id: "BA178-20260614",
        policy_id: "policy-optimistic",
        payout: 50,
        delay_minutes: 31,
        signature: "0xoptimistic1234567890",
        settle_duration_ms: 99,
      });
      useEventStore.getState().addFlare({
        flight_id: "BA178-20260614",
        policy_id: "policy-persisted",
        payout: 80,
        delay_minutes: 45,
        signature: "0xpersisted",
        settle_duration_ms: 118,
      });
    });

    const { result } = renderHook(() => useClaims(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.claims).toHaveLength(2));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/claims/recent?limit=50",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result.current.claims[0]).toMatchObject({
      id: "optimistic-0xoptimistic1234",
      policy_id: "policy-optimistic",
      payout: 50,
      delay_minutes: 31,
      signature: "0xoptimistic1234567890",
      settled_at: 1_781_438_400,
      settle_duration_ms: 99,
    });
    expect(result.current.claims[1].id).toBe("c-persisted");
  });
});
