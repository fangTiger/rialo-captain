import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closePool,
  getMyPool,
  getPoolTimeline,
  openPool,
  patchPool,
} from "../api/pool";
import { apiFetch } from "../api/client";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("pool api", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("opens pools through POST /pools", async () => {
    mockedApiFetch.mockResolvedValueOnce({ id: "pool-1" });

    await openPool({
      preset_style: "steady",
      delay_threshold_min: 30,
      payout_multiplier: 3,
      stake_ria: 200,
      include_hubs: true,
      exclude_thunderstorm: true,
      cover_red_eye: false,
    });

    expect(mockedApiFetch).toHaveBeenCalledWith("/pools", {
      method: "POST",
      body: JSON.stringify({
        preset_style: "steady",
        delay_threshold_min: 30,
        payout_multiplier: 3,
        stake_ria: 200,
        include_hubs: true,
        exclude_thunderstorm: true,
        cover_red_eye: false,
      }),
    });
  });

  it("reads, patches, closes, and loads timeline using pool endpoints", async () => {
    mockedApiFetch.mockResolvedValue({});

    await getMyPool();
    await patchPool("pool-1", { delay_threshold_min: 45 });
    await closePool("pool-1");
    await getPoolTimeline("pool-1", 25);

    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, "/pools/me");
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, "/pools/pool-1", {
      method: "PATCH",
      body: JSON.stringify({ delay_threshold_min: 45 }),
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(3, "/pools/pool-1", {
      method: "DELETE",
    });
    expect(mockedApiFetch).toHaveBeenNthCalledWith(4, "/pools/pool-1/timeline?limit=25");
  });
});
