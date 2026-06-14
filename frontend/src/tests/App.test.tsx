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

      if (url.includes("/api/claims/recent?limit=50")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: "c1",
                policy_id: "policy-alpha-123",
                payout: 80,
                delay_minutes: 45,
                signature: "0xabcdef1234567890abcdef",
                settled_at: 1_800_000_000,
                settle_duration_ms: 118,
              },
            ]),
            { status: 200 },
          ),
        );
      }

      if (url.includes("/api/routes/hot?limit=30")) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                callsign: "BA178",
                policy_count: 5,
                delay_rate: 0.6,
                samples: 5,
              },
              {
                callsign: "DL101",
                policy_count: 3,
                delay_rate: 0.2,
                samples: 3,
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

  it("mounts Claims Feed at /claims inside the protected app shell", async () => {
    window.history.pushState({}, "", "/claims");

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <App />
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("SESSION AUTO-SETTLED")).toBeInTheDocument(),
    );
    expect(screen.getByText("1 claims, paid by reactive contract")).toBeInTheDocument();
    expect(screen.getByText("policy-alp…")).toBeInTheDocument();
    expect(screen.getByText("+80 RIA")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
  });

  it("mounts Hot Routes at /routes inside the protected app shell", async () => {
    window.history.pushState({}, "", "/routes");

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <App />
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    expect(screen.getByText("DL101")).toBeInTheDocument();
    expect(screen.getByText("5 pol")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
  });

  it("mounts Rialo Inside at /rialo-inside inside the protected app shell", async () => {
    window.history.pushState({}, "", "/rialo-inside");

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <App />
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText(/Six roles/)).toBeInTheDocument());
    expect(screen.getByText("TRADITIONAL")).toBeInTheDocument();
    expect(screen.getByText("Reactive Contract")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
  });
});
