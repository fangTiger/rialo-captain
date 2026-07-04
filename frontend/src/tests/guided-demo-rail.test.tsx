import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuidedDemoRail } from "../components/demo/GuidedDemoRail";
import {
  completeGuidedDemoPurchase,
  createIdleGuidedDemoState,
  pauseGuidedDemo,
  requestGuidedDemoReplay,
  selectGuidedDemoScenario,
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
const onSelectScenario = vi.fn();
const onReplaySettlement = vi.fn();
const onAskScenario = vi.fn();
const onOpenEvidenceStory = vi.fn();

function renderRail(state = createIdleGuidedDemoState()) {
  return render(
    <GuidedDemoRail
      state={state}
      onExit={onExit}
      onResume={onResume}
      onStart={onStart}
      onUseRecommendedFlight={onUseRecommendedFlight}
      onSelectScenario={onSelectScenario}
      onReplaySettlement={onReplaySettlement}
      onAskScenario={onAskScenario}
      onOpenEvidenceStory={onOpenEvidenceStory}
    />,
  );
}

function renderEmbeddedRail(state = createIdleGuidedDemoState()) {
  return render(
    <GuidedDemoRail
      embedded
      state={state}
      onExit={onExit}
      onResume={onResume}
      onStart={onStart}
      onUseRecommendedFlight={onUseRecommendedFlight}
      onSelectScenario={onSelectScenario}
      onReplaySettlement={onReplaySettlement}
      onAskScenario={onAskScenario}
      onOpenEvidenceStory={onOpenEvidenceStory}
    />,
  );
}

describe("GuidedDemoRail", () => {
  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
      writable: true,
    });
  });

  it("renders the start action from idle", () => {
    renderRail();

    expect(screen.getByRole("button", { name: "Start guide" })).toBeInTheDocument();
  });

  it("shows the three demo steps and recommended flight in select flight state", () => {
    renderRail(startGuidedDemo(recommendedFlight));

    expect(screen.getByText("Guided flow")).toBeInTheDocument();
    expect(screen.getByText("Scenario")).toBeInTheDocument();
    expect(screen.getByText("Select flight")).toBeInTheDocument();
    expect(screen.getByText("Buy cover")).toBeInTheDocument();
    expect(screen.getByText("Settlement replay")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Smooth payout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "At risk flight" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evidence deep dive" })).toBeInTheDocument();
    expect(
      screen.getByText("Show a confident buy flow that lands in a clean settlement replay."),
    ).toBeInTheDocument();
    expect(screen.getByText("Select flight")).toBeInTheDocument();
    expect(screen.getByText("Recommended flight")).toBeInTheDocument();
    expect(screen.getByText("BA178")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Use recommended flight" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Guided demo")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo scenario")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start guided demo" })).not.toBeInTheDocument();
  });

  it("calls onSelectScenario and updates the visible goal when the state rerenders", () => {
    const { rerender } = renderRail(startGuidedDemo(recommendedFlight));

    fireEvent.click(screen.getByRole("button", { name: "Evidence deep dive" }));

    expect(onSelectScenario).toHaveBeenCalledWith("evidence-deep-dive");

    rerender(
      <GuidedDemoRail
        state={selectGuidedDemoScenario(
          startGuidedDemo(recommendedFlight),
          "evidence-deep-dive",
        )}
        onExit={onExit}
        onResume={onResume}
        onStart={onStart}
        onUseRecommendedFlight={onUseRecommendedFlight}
        onSelectScenario={onSelectScenario}
        onReplaySettlement={onReplaySettlement}
        onAskScenario={onAskScenario}
        onOpenEvidenceStory={onOpenEvidenceStory}
      />,
    );

    expect(
      screen.getByText("Open the evidence story and explain how settlement was proven."),
    ).toBeInTheDocument();
    expect(screen.getByText("Select flight")).toBeInTheDocument();
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
    expect(screen.getByText("Replay running #1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restart replay" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open evidence story" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Replay settlement" }),
    ).not.toBeInTheDocument();
  });

  it("wires replay settlement, evidence story, and demo-only copilot actions without changing layout affordances", () => {
    renderRail(
      requestGuidedDemoReplay(
        completeGuidedDemoPurchase(
          selectGuidedDemoFlight(
            startGuidedDemo(recommendedFlight),
            recommendedFlight,
          ),
          {
            id: "policy-1",
            callsign: "BA178",
            flightId: "BA178-20260630",
            premium: 12,
            payout: 60,
          },
        ),
      ),
    );

    expect(screen.getByText("Replay running #2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restart replay" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open evidence story" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ask why this payout is likely",
      }),
    );

    expect(onReplaySettlement).toHaveBeenCalledTimes(1);
    expect(onOpenEvidenceStory).toHaveBeenCalledTimes(1);
    expect(onAskScenario).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Exit guide" }));

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

  it("uses an internally scrollable panel when embedded in the desktop right HUD rail", () => {
    renderEmbeddedRail(startGuidedDemo(recommendedFlight));

    expect(screen.getByTestId("guided-demo-rail-container")).toHaveAttribute(
      "data-layout",
      "stacked",
    );
    expect(screen.getByTestId("guided-demo-rail-container")).toHaveStyle({
      position: "static",
      width: "100%",
      minHeight: "0",
      height: "100%",
    });
    expect(screen.getByTestId("guided-demo-rail")).toHaveStyle({
      width: "100%",
      minHeight: "0",
      maxHeight: "100%",
      overflowY: "auto",
      scrollbarWidth: "thin",
    });
    expect(screen.getByTestId("guided-demo-rail")).toHaveAttribute(
      "tabindex",
      "0",
    );
  });
});
