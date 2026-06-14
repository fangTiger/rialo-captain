import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { useEventStore } from "../store/eventStore";

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => {},
}));

describe("App routes", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "u1",
              email: "captain@rialo.test",
              name: "Captain",
              avatar_url: "",
              balance: 990,
            }),
            { status: 200 },
          ),
        );
      }

      if (url.includes("/api/policies")) {
        return Promise.resolve(
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
        );
      }

      return Promise.resolve(new Response("{}", { status: 200 }));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts My Hangar at /policies inside the protected app shell", async () => {
    window.history.pushState({}, "", "/policies");

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <App />
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );
    expect(screen.getByText("MY HANGAR")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
  });
});
