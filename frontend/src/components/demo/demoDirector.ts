export interface GuidedDemoFlight {
  callsign: string;
  flightId: string;
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
}

export function createIdleGuidedDemoState(): GuidedDemoState {
  return {
    status: "idle",
    recommendedFlight: null,
    selectedFlight: null,
    purchasedPolicy: null,
  };
}

export function startGuidedDemo(
  recommendedFlight: GuidedDemoFlight | null,
): GuidedDemoState {
  return {
    status: "select-flight",
    recommendedFlight,
    selectedFlight: null,
    purchasedPolicy: null,
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

export function exitGuidedDemo(_: GuidedDemoState): GuidedDemoState {
  return createIdleGuidedDemoState();
}

export function isGuidedDemoActive(state: GuidedDemoState): boolean {
  return state.status !== "idle";
}
