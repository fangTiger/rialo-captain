import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../api/pool";
import { getMyPool, openPool } from "../api/pool";
import { StudioShell } from "../routes/StudioShell";
import { usePoolStore } from "../store/pool";

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => ({
    ask: vi.fn().mockResolvedValue(undefined),
    response: null,
    isLoading: false,
    errorMessage: null,
  }),
}));

vi.mock("../api/pool", async () => {
  const actual = await vi.importActual<typeof import("../api/pool")>("../api/pool");
  return {
    ...actual,
    getMyPool: vi.fn(),
    openPool: vi.fn(),
    patchPool: vi.fn(),
    closePool: vi.fn(),
  };
});

vi.mock("../hooks/useMe", () => ({
  useMe: () => ({
    user: {
      id: "user-1",
      email: "captain@rialo.test",
      name: "Captain",
      avatar_url: "",
      balance: 500,
    },
  }),
}));

const mockedGetMyPool = vi.mocked(getMyPool);
const mockedOpenPool = vi.mocked(openPool);

const openedPool: Pool = {
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

function renderStudioShell() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <StudioShell />
    </SWRConfig>,
  );
}

describe("StudioShell", () => {
  beforeEach(() => {
    mockedGetMyPool.mockReset();
    mockedOpenPool.mockReset();
    usePoolStore.getState().resetPoolState();
  });

  it("renders the empty studio and opens a steady pool", async () => {
    mockedGetMyPool.mockResolvedValueOnce(null);
    mockedOpenPool.mockResolvedValueOnce(openedPool);

    renderStudioShell();

    expect(
      await screen.findByText("Underwrite delay risk in 3 seconds."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OPEN POOL ▸" }));

    await waitFor(() => {
      expect(mockedOpenPool).toHaveBeenCalledWith({
        preset_style: "steady",
        stake_ria: 200,
        delay_threshold_min: 30,
        payout_multiplier: 3,
        include_hubs: true,
        exclude_thunderstorm: true,
        cover_red_eye: false,
      });
    });
    expect(await screen.findByText("Underwriter pool live")).toBeInTheDocument();
    expect(screen.getByText("PAID OUT")).toBeInTheDocument();
    expect(usePoolStore.getState().activePool?.id).toBe("pool-1");
  });
});
