import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { usePolicies } from "../hooks/usePolicies";
import { useEventStore } from "../store/eventStore";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("usePolicies", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches policies and revalidates after a FLARE event", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "p1",
              flight_id: "BA178-20260614",
              premium: 10,
              payout: 80,
              status: "active",
              contract_ref: "mock-p1",
              created_at: 1,
            },
          ]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "p1",
              flight_id: "BA178-20260614",
              premium: 10,
              payout: 80,
              status: "paid",
              contract_ref: "mock-p1",
              created_at: 1,
            },
          ]),
          { status: 200 },
        ),
      );

    const { result } = renderHook(() => usePolicies(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.policies).toHaveLength(1));
    expect(result.current.policies[0].status).toBe("active");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/policies",
      expect.objectContaining({ credentials: "include" }),
    );

    act(() => {
      useEventStore.getState().addFlare({
        flight_id: "BA178-20260614",
        policy_id: "p1",
        payout: 80,
        delay_minutes: 45,
        signature: "0xabc",
        settle_duration_ms: 120,
      });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.policies[0].status).toBe("paid"));
  });
});
