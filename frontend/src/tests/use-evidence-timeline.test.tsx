import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { useEvidenceTimeline } from "../hooks/useEvidenceTimeline";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("useEvidenceTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses /claims/{id}/timeline for claim subjects", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      subject: {
        policy_id: "policy-1",
        flight_id: "flight-1",
        claim_id: "claim-1",
      },
      events: [
        {
          id: "event-1",
          type: "claim.settled",
          title: "Claim settled",
          source: "claim_engine",
          created_at: 1_718_000_000,
          payload: {
            tx_hash: "0xabc",
          },
        },
      ],
    });

    const { result } = renderHook(
      () => useEvidenceTimeline({ kind: "claim", id: "claim-1" }),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.timeline?.subject.claim_id).toBe("claim-1"),
    );
    expect(apiFetch).toHaveBeenCalledWith("/claims/claim-1/timeline");
  });

  it("uses /policies/{id}/timeline for policy subjects", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      subject: {
        policy_id: "policy-9",
        flight_id: "flight-9",
        claim_id: null,
      },
      events: [],
    });

    const { result } = renderHook(
      () => useEvidenceTimeline({ kind: "policy", id: "policy-9" }),
      { wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(result.current.timeline?.subject.policy_id).toBe("policy-9"),
    );
    expect(apiFetch).toHaveBeenCalledWith("/policies/policy-9/timeline");
  });

  it("does not fetch when subject is null", () => {
    const { result } = renderHook(() => useEvidenceTimeline(null), {
      wrapper: Wrapper,
    });

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.timeline).toBeNull();
    expect(result.current.events).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
