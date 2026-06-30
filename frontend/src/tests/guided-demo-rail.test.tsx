import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedDemoRail } from "../components/demo/GuidedDemoRail";
import {
  completeGuidedDemoPurchase,
  createIdleGuidedDemoState,
  pauseGuidedDemo,
  selectGuidedDemoFlight,
  startGuidedDemo,
} from "../components/demo/demoDirector";

const recommendedFlight = {
  callsign: "BA178",
  flightId: "BA178-20260630",
};

const onStart = vi.fn();
const onUseRecommendedFlight = vi.fn();
const onResume = vi.fn();
const onExit = vi.fn();

function renderRail(state = createIdleGuidedDemoState()) {
  return render(
    <GuidedDemoRail
      state={state}
      onExit={onExit}
      onResume={onResume}
      onStart={onStart}
      onUseRecommendedFlight={onUseRecommendedFlight}
    />,
  );
}

describe("GuidedDemoRail", () => {
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
  });

  it("renders the start action from idle", () => {
    renderRail();

    expect(
      screen.getByRole("button", { name: "Start guided demo" }),
    ).toBeInTheDocument();
  });

  it("shows the three demo steps and recommended flight in select flight state", () => {
    renderRail(startGuidedDemo(recommendedFlight));

    expect(screen.getByText("Select flight")).toBeInTheDocument();
    expect(screen.getByText("Buy cover")).toBeInTheDocument();
    expect(screen.getByText("Settlement replay")).toBeInTheDocument();
    expect(screen.getByText("Recommended flight")).toBeInTheDocument();
    expect(screen.getByText("BA178")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use recommended flight" }),
    ).toBeInTheDocument();
  });

  it("shows resume for a paused buy cover step and keeps the selected flight visible", () => {
    const pausedState = pauseGuidedDemo(
      selectGuidedDemoFlight(startGuidedDemo(recommendedFlight), recommendedFlight),
    );

    renderRail(pausedState);

    expect(screen.getByText("Selected flight")).toBeInTheDocument();
    expect(screen.getByText("BA178")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("shows replay purchase summary after a successful purchase", () => {
    const replayState = completeGuidedDemoPurchase(
      selectGuidedDemoFlight(startGuidedDemo(recommendedFlight), recommendedFlight),
      {
        id: "policy-1",
        callsign: "BA178",
        flightId: "BA178-20260630",
        premium: 12,
        payout: 60,
      },
    );

    renderRail(replayState);

    expect(screen.getByText("Settlement replay")).toBeInTheDocument();
    expect(screen.getByText("Policy policy-1")).toBeInTheDocument();
    expect(screen.getByText("12 RIA")).toBeInTheDocument();
    expect(screen.getByText("60 RIA")).toBeInTheDocument();
  });

  it("keeps map hit testing outside the compact rail and wires start/exit actions", () => {
    renderRail(startGuidedDemo(recommendedFlight));

    expect(screen.getByTestId("guided-demo-rail-container")).toHaveStyle({
      pointerEvents: "none",
    });
    expect(screen.getByTestId("guided-demo-rail")).toHaveStyle({
      pointerEvents: "auto",
      width: "min(100%, 21rem)",
    });

    fireEvent.click(screen.getByRole("button", { name: "Use recommended flight" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit demo" }));

    expect(onUseRecommendedFlight).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("moves to a bottom layout on narrow screens to avoid overlapping AI Briefing", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 640,
      writable: true,
    });

    renderRail(startGuidedDemo(recommendedFlight));

    expect(screen.getByTestId("guided-demo-rail-container")).toHaveAttribute(
      "data-layout",
      "bottom",
    );
    expect(screen.getByTestId("guided-demo-rail-container")).toHaveStyle({
      top: "auto",
      bottom: "20px",
      left: "20px",
      right: "20px",
      pointerEvents: "none",
    });
  });
});
