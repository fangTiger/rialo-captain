import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { useEventStore } from "../store/eventStore";
import { DataStaleBadge } from "../components/tower/DataStaleBadge";
import { EventFeedSidebar } from "../components/tower/EventFeedSidebar";
import { KPIBand } from "../components/tower/KPIBand";
import { RadarSweep } from "../components/tower/RadarSweep";

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
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "idle" });
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("toggles KPI tick state from tick id even when payout is unchanged", () => {
    vi.useFakeTimers();
    useEventStore.getState().addFlare({
      flight_id: "BA178-20260614",
      policy_id: "p1",
      payout: 80,
      delay_minutes: 45,
      signature: "0xabcdef123456",
      settle_duration_ms: 118,
    });

    const { rerender } = render(<KPIBand tickId={0} />);

    const band = screen.getByTestId("kpi-band");
    expect(band).toHaveAttribute("aria-live", "polite");
    expect(band).not.toHaveClass("kpi-band--tick");

    rerender(<KPIBand tickId={1} />);
    expect(screen.getAllByText("80")).toHaveLength(1);
    expect(band).toHaveClass("kpi-band--tick");

    act(() => vi.advanceTimersByTime(650));
    expect(band).not.toHaveClass("kpi-band--tick");

    rerender(<KPIBand tickId={2} />);
    expect(screen.getAllByText("80")).toHaveLength(1);
    expect(band).toHaveClass("kpi-band--tick");
  });

  it("shows RadarSweep AT RISK label only when requested", () => {
    const { rerender } = render(<RadarSweep />);

    expect(screen.getByTestId("radar-sweep-root")).toBeInTheDocument();
    expect(document.querySelector(".radar-sweep")).toBeInTheDocument();
    expect(screen.queryByTestId("radar-at-risk")).not.toBeInTheDocument();

    rerender(<RadarSweep atRisk protagonistCallsign="BA178" />);

    expect(document.querySelector(".radar-sweep")).toBeInTheDocument();
    expect(screen.getByTestId("radar-at-risk")).toHaveTextContent("AT RISK");
    expect(screen.getByTestId("radar-at-risk")).toHaveAttribute(
      "aria-label",
      "BA178 AT RISK",
    );
  });
});
