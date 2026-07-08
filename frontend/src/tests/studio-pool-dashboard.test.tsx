import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Pool } from "../api/pool";
import { PoolDashboard } from "../components/studio/PoolDashboard";
import type { PoolTickerEvent } from "../store/pool";

const activePool: Pool = {
  id: "pool-1",
  user_id: "user-1",
  preset_style: "steady",
  status: "active",
  stake_ria: 200,
  balance: 130,
  pl: -70,
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

const ticker: PoolTickerEvent[] = [
  {
    id: "t-paid",
    type: "paid",
    label: "Paid out AA100",
    amount: 80,
    flightId: "flight-1",
    policyId: "policy-1",
    tone: "warning",
    payload: {},
    receivedAt: 1,
  },
  {
    id: "t-bound",
    type: "bound",
    label: "Bound AA100",
    amount: 10,
    flightId: "flight-1",
    policyId: "policy-1",
    tone: "positive",
    payload: {},
    receivedAt: 0,
  },
];

describe("PoolDashboard", () => {
  it("renders active pool KPIs and ticker rows", () => {
    render(
      <PoolDashboard
        exposure={90}
        hits24h={1}
        paidOut={80}
        pool={activePool}
        ticker={ticker}
      />,
    );

    expect(screen.getByText("EXPOSURE")).toBeInTheDocument();
    expect(screen.getByText("90 RIA")).toBeInTheDocument();
    expect(screen.getByText("HITS 24H")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("PAID OUT")).toBeInTheDocument();
    expect(screen.getByText("80 RIA")).toBeInTheDocument();
    expect(screen.getByText("P/L")).toBeInTheDocument();
    expect(screen.getByText("-70 RIA")).toBeInTheDocument();

    const eventList = screen.getByRole("list", { name: "Pool event ticker" });
    expect(within(eventList).getAllByRole("listitem")).toHaveLength(2);
    expect(within(eventList).getByText("Paid out AA100")).toBeInTheDocument();
    expect(within(eventList).getByText("-80 RIA")).toBeInTheDocument();
    expect(within(eventList).getByText("Bound AA100")).toBeInTheDocument();
    expect(within(eventList).getByText("+10 RIA")).toBeInTheDocument();
  });

  it("shows an empty ticker state before the first bind", () => {
    render(
      <PoolDashboard
        exposure={0}
        hits24h={0}
        paidOut={0}
        pool={{ ...activePool, balance: 200, pl: 0 }}
        ticker={[]}
      />,
    );

    expect(screen.getByText("Waiting for simulator demand")).toBeInTheDocument();
  });
});
