import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyHangar } from "../routes/MyHangar";
import { useEventStore } from "../store/eventStore";

describe("MyHangar", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "p1",
              flight_id: "BA178-20260614",
              premium: 10,
              payout: 80,
              status: "active",
              contract_ref: "mock-policy-one",
              created_at: 1,
            },
            {
              id: "p2",
              flight_id: "DL101-20260614",
              premium: 5,
              payout: 30,
              status: "paid",
              contract_ref: "mock-policy-two",
              created_at: 2,
            },
            {
              id: "p3",
              flight_id: "UA200-20260614",
              premium: 20,
              payout: 120,
              status: "expired",
              contract_ref: "mock-policy-three",
              created_at: 3,
            },
          ]),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("groups policies into active, paid, and expired hangar lanes", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MyHangar />
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/PAID/)).toBeInTheDocument();
    expect(screen.getByText(/EXPIRED/)).toBeInTheDocument();
    expect(screen.getByText("DL101-20260614")).toBeInTheDocument();
    expect(screen.getByText("UA200-20260614")).toBeInTheDocument();
    expect(screen.getByText("10 RIA")).toBeInTheDocument();
    expect(screen.getByText("120 RIA")).toBeInTheDocument();
  });
});
