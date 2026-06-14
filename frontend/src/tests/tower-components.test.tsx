import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useEventStore } from "../store/eventStore";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: [],
    stale: true,
    staleSeconds: 42,
    error: undefined,
    isLoading: false,
  }),
}));

describe("tower components", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
  });

  it("shows stale data badge when live data is old", () => {
    render(<DataStaleBadge />);

    expect(screen.getByText(/DATA STALE/)).toHaveTextContent("42s");
  });

  it("renders event feed rows and KPI totals from flares", () => {
    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xabcdef123456",
      settle_duration_ms: 118,
    });

    render(
      <>
        <EventFeedSidebar />
        <KPIBand />
      </>,
    );

    // EventFeedSidebar 默认收起为 chip; 点开展开
    fireEvent.click(screen.getByRole("button", { name: /EVENT FEED/ }));

    expect(screen.getByText("EVENT FEED")).toBeInTheDocument();
    expect(screen.getByText("BA178-20260614")).toBeInTheDocument();
    expect(screen.getByText("+80 RIA")).toBeInTheDocument();
    expect(screen.getByText("SESSION FLARES")).toBeInTheDocument();
    expect(screen.getByText("PAYOUT")).toBeInTheDocument();
    expect(screen.getAllByText("80")).toHaveLength(1);
  });
});
