import { describe, it, expect, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { TowerShell } from "../routes/TowerShell";

vi.mock("../components/tower/GlobeMap", () => ({
  GlobeMap: ({
    onSelectFlight,
  }: {
    onSelectFlight?: (callsign: string) => void;
  }) => (
    <button type="button" onClick={() => onSelectFlight?.("BA178")}>
      mock globe
    </button>
  ),
}));

vi.mock("../components/tower/RadarSweep", () => ({
  RadarSweep: () => <div>radar sweep</div>,
}));

vi.mock("../components/tower/EventFeedSidebar", () => ({
  EventFeedSidebar: () => <div>event feed</div>,
}));

vi.mock("../components/tower/KPIBand", () => ({
  KPIBand: () => <div>kpi band</div>,
}));

vi.mock("../components/tower/DataStaleBadge", () => ({
  DataStaleBadge: () => <div>data stale</div>,
}));

function FlightDetailProbe() {
  const { id } = useParams();
  return <div>flight detail {id}</div>;
}

describe("TowerShell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("composes the live tower layers and navigates when a flight is selected", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T08:00:00.000Z"));

    render(
      <MemoryRouter
        initialEntries={["/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<TowerShell />} />
          <Route path="/flight/:id" element={<FlightDetailProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("mock globe")).toBeInTheDocument();
    expect(screen.getByText("radar sweep")).toBeInTheDocument();
    expect(screen.getByText("event feed")).toBeInTheDocument();
    expect(screen.getByText("kpi band")).toBeInTheDocument();
    expect(screen.getByText("data stale")).toBeInTheDocument();

    fireEvent.click(screen.getByText("mock globe"));

    expect(screen.getByText("flight detail BA178-20260614")).toBeInTheDocument();
  });
});
