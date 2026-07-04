import { describe, expect, it } from "vitest";
import {
  completeGuidedDemoPurchase,
  completeGuidedDemoReplay,
  createIdleGuidedDemoState,
  getGuidedDemoScenario,
  requestGuidedDemoReplay,
  selectGuidedDemoScenario,
  exitGuidedDemo,
  pauseGuidedDemo,
  resumeGuidedDemo,
  selectGuidedDemoFlight,
  startGuidedDemo,
  type GuidedDemoFlight,
} from "../components/demo/demoDirector";

const recommendedFlight: GuidedDemoFlight = {
  callsign: "BA178",
  flightId: "BA178-20260630",
};

const replacementFlight: GuidedDemoFlight = {
  callsign: "UA200",
  flightId: "UA200-20260630",
};

describe("guided demo director", () => {
  it("starts from idle with the default smooth payout scenario", () => {
    const state = createIdleGuidedDemoState();

    expect(state.selectedScenarioId).toBe("smooth-payout");
    expect(getGuidedDemoScenario(state.selectedScenarioId)).toMatchObject({
      id: "smooth-payout",
      label: "Smooth payout",
      nextAction: "Select flight",
    });
    expect(state.replayToken).toBe(0);
  });

  it("starts from idle and enters select flight with the recommended flight", () => {
    const state = startGuidedDemo(recommendedFlight);

    expect(state.status).toBe("select-flight");
    expect(state.recommendedFlight).toEqual(recommendedFlight);
    expect(state.selectedFlight).toBeNull();
    expect(state.purchasedPolicy).toBeNull();
  });

  it("changes only scenario fields when selecting a scenario and preserves that choice on start", () => {
    const idleState = createIdleGuidedDemoState();
    const selectedScenarioState = selectGuidedDemoScenario(
      idleState,
      "evidence-deep-dive",
    );

    expect(selectedScenarioState.status).toBe("idle");
    expect(selectedScenarioState.selectedScenarioId).toBe("evidence-deep-dive");
    expect(selectedScenarioState.selectedFlight).toBeNull();
    expect(selectedScenarioState.purchasedPolicy).toBeNull();

    const startedState = startGuidedDemo(recommendedFlight, selectedScenarioState);

    expect(startedState.status).toBe("select-flight");
    expect(startedState.selectedScenarioId).toBe("evidence-deep-dive");
    expect(getGuidedDemoScenario(startedState.selectedScenarioId)).toMatchObject({
      goal: "Open the evidence story and explain how settlement was proven.",
      nextAction: "Select flight",
    });
  });

  it("selects a flight and advances to buy cover", () => {
    const state = selectGuidedDemoFlight(
      startGuidedDemo(recommendedFlight),
      replacementFlight,
    );

    expect(state.status).toBe("buy-cover");
    expect(state.selectedFlight).toEqual(replacementFlight);
    expect(state.purchasedPolicy).toBeNull();
  });

  it("pauses and resumes the same selected flight without creating a policy", () => {
    const selectedState = selectGuidedDemoFlight(
      startGuidedDemo(recommendedFlight),
      recommendedFlight,
    );

    const pausedState = pauseGuidedDemo(selectedState);

    expect(pausedState.status).toBe("paused");
    expect(pausedState.selectedFlight).toEqual(recommendedFlight);
    expect(pausedState.purchasedPolicy).toBeNull();

    const resumedState = resumeGuidedDemo(pausedState);

    expect(resumedState.status).toBe("buy-cover");
    expect(resumedState.selectedFlight).toEqual(recommendedFlight);
    expect(resumedState.purchasedPolicy).toBeNull();
  });

  it("moves to replay with the purchased policy summary and can mark replay complete", () => {
    const selectedState = selectGuidedDemoFlight(
      startGuidedDemo(recommendedFlight),
      recommendedFlight,
    );

    const replayState = completeGuidedDemoPurchase(selectedState, {
      id: "policy-1",
      flightId: "BA178-20260630",
      callsign: "BA178",
      premium: 12,
      payout: 60,
    });

    expect(replayState.status).toBe("replay");
    expect(replayState.selectedFlight).toEqual(recommendedFlight);
    expect(replayState.replayToken).toBe(1);
    expect(replayState.purchasedPolicy).toEqual({
      id: "policy-1",
      flightId: "BA178-20260630",
      callsign: "BA178",
      premium: 12,
      payout: 60,
    });

    const completedState = completeGuidedDemoReplay(replayState);

    expect(completedState.status).toBe("complete");
    expect(completedState.purchasedPolicy?.id).toBe("policy-1");
  });

  it("requests a replay only after purchase and keeps the same policy context", () => {
    const selectedState = selectGuidedDemoFlight(
      startGuidedDemo(recommendedFlight),
      recommendedFlight,
    );

    expect(requestGuidedDemoReplay(selectedState)).toBe(selectedState);

    const replayState = completeGuidedDemoPurchase(selectedState, {
      id: "policy-1",
      flightId: "BA178-20260630",
      callsign: "BA178",
      premium: 12,
      payout: 60,
    });

    const replayRequestedState = requestGuidedDemoReplay(replayState);

    expect(replayRequestedState.status).toBe("replay");
    expect(replayRequestedState.replayToken).toBe(2);
    expect(replayRequestedState.purchasedPolicy).toEqual(
      replayState.purchasedPolicy,
    );
    expect(replayRequestedState.selectedScenarioId).toBe(
      replayState.selectedScenarioId,
    );
  });

  it("exits back to idle and clears demo context", () => {
    const replayState = completeGuidedDemoPurchase(
      selectGuidedDemoFlight(startGuidedDemo(recommendedFlight), recommendedFlight),
      {
        id: "policy-1",
        flightId: "BA178-20260630",
        callsign: "BA178",
        premium: 12,
        payout: 60,
      },
    );

    const state = exitGuidedDemo(replayState);

    expect(state).toEqual(createIdleGuidedDemoState());
  });
});
