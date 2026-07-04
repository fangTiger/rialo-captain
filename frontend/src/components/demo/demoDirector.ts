export interface GuidedDemoFlight {
  callsign: string;
  flightId: string;
}

export type GuidedDemoScenarioId =
  | "smooth-payout"
  | "at-risk-flight"
  | "evidence-deep-dive";

export interface GuidedDemoScenario {
  id: GuidedDemoScenarioId;
  label: string;
  goal: string;
  nextAction: string;
  promptLabel: string;
  promptQuestion: string;
}

export interface GuidedDemoPolicy {
  id: string;
  flightId: string;
  callsign: string;
  premium: number;
  payout: number;
}

export type GuidedDemoStatus =
  | "idle"
  | "select-flight"
  | "buy-cover"
  | "paused"
  | "replay"
  | "complete";

export interface GuidedDemoState {
  status: GuidedDemoStatus;
  recommendedFlight: GuidedDemoFlight | null;
  selectedFlight: GuidedDemoFlight | null;
  purchasedPolicy: GuidedDemoPolicy | null;
  selectedScenarioId: GuidedDemoScenarioId;
  replayToken: number;
}

const DEFAULT_SCENARIO_ID: GuidedDemoScenarioId = "smooth-payout";

export const GUIDED_DEMO_SCENARIOS: Record<
  GuidedDemoScenarioId,
  GuidedDemoScenario
> = {
  "smooth-payout": {
    id: "smooth-payout",
    label: "Smooth payout",
    goal: "Show a confident buy flow that lands in a clean settlement replay.",
    nextAction: "Select flight",
    promptLabel: "Ask why this payout is likely",
    promptQuestion: "Why is this smooth payout scenario likely to settle cleanly?",
  },
  "at-risk-flight": {
    id: "at-risk-flight",
    label: "At risk flight",
    goal: "Focus the operator on a flight that looks payout-prone before purchase.",
    nextAction: "Select flight",
    promptLabel: "Ask what makes this flight risky",
    promptQuestion: "What makes this flight look payout-prone right now?",
  },
  "evidence-deep-dive": {
    id: "evidence-deep-dive",
    label: "Evidence deep dive",
    goal: "Open the evidence story and explain how settlement was proven.",
    nextAction: "Select flight",
    promptLabel: "Ask how the evidence chain proves settlement",
    promptQuestion: "How does the evidence chain prove this settlement step by step?",
  },
};

export function getGuidedDemoScenario(
  scenarioId: GuidedDemoScenarioId,
): GuidedDemoScenario {
  return GUIDED_DEMO_SCENARIOS[scenarioId] ?? GUIDED_DEMO_SCENARIOS[DEFAULT_SCENARIO_ID];
}

export function createIdleGuidedDemoState(): GuidedDemoState {
  return {
    status: "idle",
    recommendedFlight: null,
    selectedFlight: null,
    purchasedPolicy: null,
    selectedScenarioId: DEFAULT_SCENARIO_ID,
    replayToken: 0,
  };
}

export function startGuidedDemo(
  recommendedFlight: GuidedDemoFlight | null,
  previousState: GuidedDemoState = createIdleGuidedDemoState(),
): GuidedDemoState {
  return {
    status: "select-flight",
    recommendedFlight,
    selectedFlight: null,
    purchasedPolicy: null,
    selectedScenarioId: previousState.selectedScenarioId,
    replayToken: 0,
  };
}

export function selectGuidedDemoFlight(
  state: GuidedDemoState,
  flight: GuidedDemoFlight,
): GuidedDemoState {
  return {
    ...state,
    status: "buy-cover",
    selectedFlight: flight,
    purchasedPolicy: null,
    replayToken: 0,
  };
}

export function selectGuidedDemoScenario(
  state: GuidedDemoState,
  scenarioId: GuidedDemoScenarioId,
): GuidedDemoState {
  return {
    ...state,
    selectedScenarioId: scenarioId,
  };
}

export function pauseGuidedDemo(state: GuidedDemoState): GuidedDemoState {
  if (state.status !== "buy-cover") return state;
  return {
    ...state,
    status: "paused",
  };
}

export function resumeGuidedDemo(state: GuidedDemoState): GuidedDemoState {
  if (state.status !== "paused") return state;
  return {
    ...state,
    status: "buy-cover",
  };
}

export function completeGuidedDemoPurchase(
  state: GuidedDemoState,
  policy: GuidedDemoPolicy,
): GuidedDemoState {
  return {
    ...state,
    status: "replay",
    purchasedPolicy: policy,
    replayToken: 1,
  };
}

export function completeGuidedDemoReplay(
  state: GuidedDemoState,
): GuidedDemoState {
  if (state.status !== "replay") return state;
  return {
    ...state,
    status: "complete",
  };
}

export function requestGuidedDemoReplay(
  state: GuidedDemoState,
): GuidedDemoState {
  if (!state.purchasedPolicy) return state;
  return {
    ...state,
    status: "replay",
    replayToken: state.replayToken + 1,
  };
}

export function exitGuidedDemo(_: GuidedDemoState): GuidedDemoState {
  return createIdleGuidedDemoState();
}

export function isGuidedDemoActive(state: GuidedDemoState): boolean {
  return state.status !== "idle";
}
