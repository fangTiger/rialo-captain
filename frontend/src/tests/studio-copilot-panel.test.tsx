import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../api/pool";
import { PoolCopilotPanel } from "../components/studio/PoolCopilotPanel";
import { usePoolStore } from "../store/pool";

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
  response: null,
  isLoading: false,
  errorMessage: null,
}));

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

const pool: Pool = {
  id: "pool-1",
  user_id: "user-1",
  preset_style: "steady",
  status: "active",
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

describe("PoolCopilotPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    copilotHarness.ask.mockReset();
    copilotHarness.ask.mockResolvedValue(undefined);
    usePoolStore.getState().resetPoolState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests an empty-state starter briefing on first load", async () => {
    render(<PoolCopilotPanel pool={null} />);

    expect(copilotHarness.ask).toHaveBeenCalledTimes(1);
    expect(copilotHarness.ask).toHaveBeenCalledWith(
      {
        question: "Recommend a starter underwriting preset for Underwriter Studio.",
        subjectType: "overview",
      },
      { openPanel: false },
    );
    expect(screen.getByText("Pool briefing")).toBeInTheDocument();
  });

  it("briefs after pool open, first bind, and every fifth bind", async () => {
    usePoolStore.getState().setActivePool(pool);
    render(<PoolCopilotPanel pool={pool} />);

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(copilotHarness.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: "pool",
        subjectId: "pool-1",
        question: "Brief this underwriting pool now that it is live.",
      }),
      { openPanel: false },
    );

    act(() => {
      for (let index = 1; index <= 5; index += 1) {
        usePoolStore.getState().applyPoolEvent("pool.policy_bound", {
          pool_id: "pool-1",
          policy_id: `policy-${index}`,
          flight_id: `flight-${index}`,
          callsign: `AA10${index}`,
          premium: 10,
          exposure_after: index * 40,
        });
      }
    });

    expect(copilotHarness.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Report the first simulator policy bound to my pool.",
      }),
      { openPanel: false },
    );
    expect(copilotHarness.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Brief the latest 5 bound policies and forward exposure.",
      }),
      { openPanel: false },
    );
  });

  it("briefs on payout and bankrupt close events", async () => {
    usePoolStore.getState().setActivePool(pool);
    render(<PoolCopilotPanel pool={pool} />);

    act(() => {
      usePoolStore.getState().applyPoolEvent("pool.claim_paid", {
        pool_id: "pool-1",
        policy_id: "policy-paid",
        flight_id: "flight-paid",
        callsign: "BA178",
        payout: 80,
        balance_after: 120,
        pl: -80,
      });
      usePoolStore.getState().applyPoolEvent("pool.closed", {
        pool_id: "pool-1",
        reason: "bankrupt",
        final_pl: -220,
      });
    });

    expect(copilotHarness.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Explain the latest payout from my underwriting pool.",
      }),
      { openPanel: false },
    );
    expect(copilotHarness.ask).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectType: "pool",
        subjectId: "pool-1",
        question: "Explain why this underwriting pool closed after drawdown.",
      }),
      { openPanel: false },
    );
  });
});
