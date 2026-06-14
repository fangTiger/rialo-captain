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

interface EventStore {
  flares: FlareEvent[];
  toasts: ToastEvent[];
  wsState: WsState;
  addFlare: (flare: FlareEvent) => void;
  addToast: (toast: ToastEvent) => void;
  dismissToast: (id: string) => void;
  setWsState: (wsState: WsState) => void;
}

const FLARES_CAP = 100;

export const useEventStore = create<EventStore>((set) => ({
  flares: [],
  toasts: [],
  wsState: "idle",
  addFlare: (flare) =>
    set((state) => ({
      flares: [flare, ...state.flares].slice(0, FLARES_CAP),
    })),
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, toast],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  setWsState: (wsState) => set({ wsState }),
}));
