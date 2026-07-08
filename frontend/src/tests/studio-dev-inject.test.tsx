import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { DevInjectDelayButton } from "../components/studio/DevInjectDelayButton";
import { usePoolStore } from "../store/pool";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("DevInjectDelayButton", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    usePoolStore.getState().resetPoolState();
    usePoolStore.getState().applyPoolEvent("pool.policy_bound", {
      pool_id: "pool-1",
      policy_id: "policy-1",
      flight_id: "BA178-20260708",
      callsign: "BA178",
      premium: 10,
      exposure_after: 80,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows only when dev login is enabled and injects the latest bound flight", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    mockedApiFetch.mockResolvedValueOnce({ flight_id: "BA178-20260708" });

    render(<DevInjectDelayButton poolId="pool-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Inject demo delay" }));

    expect(mockedApiFetch).toHaveBeenCalledWith("/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "BA178-20260708",
        delay_minutes: 45,
      }),
    });
    await waitFor(() => expect(screen.getByText("Delay injected")).toBeInTheDocument());
  });

  it("hides when dev login is disabled", () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "false");

    render(<DevInjectDelayButton poolId="pool-1" />);

    expect(
      screen.queryByRole("button", { name: "Inject demo delay" }),
    ).not.toBeInTheDocument();
  });
});
