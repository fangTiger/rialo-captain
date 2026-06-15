import type { CinemaPhase, CinemaProtagonist } from "./cinemaMachine";

export const DEMO_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
] as const;

export interface DemoFlightCandidate {
  callsign: string;
  longitude: number | null;
  latitude: number | null;
  on_ground: boolean;
  etaMinutes?: number | null;
}

export interface RealProtagonistEvent {
  id: string;
  flightId: string;
  callsign: string;
  longitude: number;
  latitude: number;
  createdAt: number;
  source: "real";
}

export interface RealQueueState {
  queue: RealProtagonistEvent[];
}

export interface RealRouteResult {
  active: CinemaProtagonist | null;
  queueState: RealQueueState;
  ignored: boolean;
}

const REAL_EVENT_LOOKBACK_MS = 60_000;
const REAL_QUEUE_CAP = 3;

export function demoNameAt(index: number): string {
  return DEMO_NAMES[index % DEMO_NAMES.length];
}

function hasUsableEta(flight: DemoFlightCandidate): boolean {
  if (flight.etaMinutes === undefined || flight.etaMinutes === null) return true;
  return flight.etaMinutes >= 5 && flight.etaMinutes <= 15;
}

function isPositionedAirborne(flight: DemoFlightCandidate): boolean {
  return (
    !flight.on_ground &&
    flight.longitude !== null &&
    flight.latitude !== null &&
    hasUsableEta(flight)
  );
}

export function chooseDemoProtagonist(
  flights: DemoFlightCandidate[],
  nameIndex = 0,
): CinemaProtagonist | null {
  const flight = flights.find(isPositionedAirborne);
  if (!flight || flight.longitude === null || flight.latitude === null) {
    return null;
  }

  return {
    kind: "DEMO",
    flightId: flight.callsign,
    callsign: flight.callsign,
    longitude: flight.longitude,
    latitude: flight.latitude,
    name: demoNameAt(nameIndex),
  };
}

export function shouldQueueRealEvent(phase: CinemaPhase): boolean {
  void phase;
  return false;
}

export function createRealQueueState(
  queue: RealProtagonistEvent[] = [],
): RealQueueState {
  return {
    queue: queue.slice(-REAL_QUEUE_CAP),
  };
}

export function queuedMoreCount(queueState: RealQueueState): number {
  return queueState.queue.length;
}

function toRealProtagonist(event: RealProtagonistEvent): CinemaProtagonist {
  return {
    kind: "REAL",
    flightId: event.flightId,
    callsign: event.callsign,
    longitude: event.longitude,
    latitude: event.latitude,
  };
}

function isFreshRealEvent(event: RealProtagonistEvent, now: number): boolean {
  return now - event.createdAt <= REAL_EVENT_LOOKBACK_MS;
}

export function routeRealProtagonistEvent({
  phase,
  now,
  event,
  queueState,
}: {
  phase: CinemaPhase;
  now: number;
  event: RealProtagonistEvent;
  queueState: RealQueueState;
}): RealRouteResult {
  if (!isFreshRealEvent(event, now)) {
    return {
      active: null,
      queueState,
      ignored: true,
    };
  }

  shouldQueueRealEvent(phase);

  return {
    active: toRealProtagonist(event),
    queueState,
    ignored: false,
  };
}
