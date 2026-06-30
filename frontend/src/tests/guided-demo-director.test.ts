import { describe, expect, it } from "vitest";
import {
  completeGuidedDemoPurchase,
  completeGuidedDemoReplay,
  createIdleGuidedDemoState,
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
  it("starts from idle and enters select flight with the recommended flight", () => {
    const state = startGuidedDemo(recommendedFlight);

    expect(state.status).toBe("select-flight");
    expect(state.recommendedFlight).toEqual(recommendedFlight);
    expect(state.selectedFlight).toBeNull();
    expect(state.purchasedPolicy).toBeNull();
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
