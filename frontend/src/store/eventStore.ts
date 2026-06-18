import { create } from "zustand";

export type WsState = "idle" | "connecting" | "open" | "retrying" | "closed";

export interface FlareEvent {
  flight_id: string;
  policy_id: string;
  payout: number;
  delay_minutes: number;
  signature: string;
  settle_duration_ms: number;
}

export interface ToastEvent {
  id: string;
  message: string;
}

export type CinemaEventType =
  | "flare"
  | "claim.settled"
  | "policy.created"
  | "flight.landed"
  | "claim.triggered";

export interface CinemaEvent {
  id: string;
  type: CinemaEventType;
  payload: Record<string, unknown>;
  receivedAt: number;
}

export interface AddCinemaEventInput {
  id?: string;
  type: CinemaEventType;
  payload: Record<string, unknown>;
  receivedAt?: number;
}

interface EventStore {
  flares: FlareEvent[];
  toasts: ToastEvent[];
  events: CinemaEvent[];
  wsState: WsState;
  addFlare: (flare: FlareEvent) => void;
  addToast: (toast: ToastEvent) => void;
  addEvent: (event: AddCinemaEventInput) => void;
  dismissToast: (id: string) => void;
  setWsState: (wsState: WsState) => void;
}

const FLARES_CAP = 100;
const EVENTS_CAP = 200;

function makeEventId() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stableValueKey(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableValueKey(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValueKey(record[key])}`)
    .join(",")}}`;
}

function flareEventKey(flare: FlareEvent) {
  return stableValueKey(flare);
}

function cinemaEventKey(type: CinemaEventType, payload: Record<string, unknown>) {
  return `${type}:${stableValueKey(payload)}`;
}

function policyEventKey(type: CinemaEventType, payload: Record<string, unknown>) {
  return typeof payload.policy_id === "string"
    ? `${type}:policy:${payload.policy_id}`
    : null;
}

export const useEventStore = create<EventStore>((set) => ({
  flares: [],
  toasts: [],
  events: [],
  wsState: "idle",
  addFlare: (flare) =>
    set((state) => {
      const incomingKey = flareEventKey(flare);
      if (
        state.flares.some(
          (existing) =>
            existing.policy_id === flare.policy_id ||
            flareEventKey(existing) === incomingKey,
        )
      ) {
        return state;
      }

      return {
        flares: [flare, ...state.flares].slice(0, FLARES_CAP),
      };
    }),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, toast],
    })),
  addEvent: (event) =>
    set((state) => {
      const incomingKey = cinemaEventKey(event.type, event.payload);
      const incomingPolicyKey = policyEventKey(event.type, event.payload);
      const alreadyRecorded = state.events.some(
        (existing) => {
          const existingPolicyKey = policyEventKey(
            existing.type,
            existing.payload,
          );
          return (
            (event.id !== undefined && existing.id === event.id) ||
            (incomingPolicyKey !== null &&
              existingPolicyKey === incomingPolicyKey) ||
            cinemaEventKey(existing.type, existing.payload) === incomingKey
          );
        },
      );
      if (alreadyRecorded) return state;

      return {
        events: [
          {
            id: event.id ?? makeEventId(),
            type: event.type,
            payload: event.payload,
            receivedAt: event.receivedAt ?? Date.now(),
          },
          ...state.events,
        ].slice(0, EVENTS_CAP),
      };
    }),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  setWsState: (wsState) => set({ wsState }),
}));
