import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClaimsForFlight } from "../hooks/useClaimsForFlight";
import { useFlight } from "../hooks/useFlight";
import { useEventStore } from "../store/eventStore";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("flight detail hooks", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-06-14T12:00:00Z"));
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches a flight detail by id", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "BA178-20260614",
          callsign: "BA178",
          origin: "LHR",
          destination: "JFK",
          delay_rate: 0.25,
          samples: 12,
          live_delay_minutes: 12,
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useFlight("BA178-20260614"), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.flight?.id).toBe("BA178-20260614"),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flights/BA178-20260614",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("fetches claims for a flight id and skips empty ids", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "c1",
            policy_id: "p1",
            flight_id: "BA178-20260614",
            payout: 80,
            delay_minutes: 45,
            signature: "0xabc",
            settled_at: 1_800_000_000,
            settle_duration_ms: 100,
          },
        ]),
        { status: 200 },
      ),
    );

    const { result, rerender } = renderHook(
      ({ flightId }) => useClaimsForFlight(flightId),
      {
        initialProps: { flightId: "BA178-20260614" },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.claims).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/claims/recent?flight_id=BA178-20260614",
      expect.objectContaining({ credentials: "include" }),
    );

    fetchMock.mockClear();
    rerender({ flightId: "" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps current flare claims visible for a flight when the API no longer returns them", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "policy-local",
      payout: 55,
      delay_minutes: 34,
      signature: "0xlocalflare1234567890",
      settle_duration_ms: 88,
    });

    const { result } = renderHook(
      ({ flightId }) => useClaimsForFlight(flightId),
      {
        initialProps: { flightId: "BA178-20260614" },
        wrapper: Wrapper,
      },
    );

    await waitFor(() => expect(result.current.claims).toHaveLength(1));
    expect(result.current.claims[0]).toMatchObject({
      id: "optimistic-0xlocalflare1234",
      policy_id: "policy-local",
      flight_id: "BA178-20260614",
      payout: 55,
      delay_minutes: 34,
      signature: "0xlocalflare1234567890",
      settled_at: 1_781_438_400,
      settle_duration_ms: 88,
    });
  });
});
