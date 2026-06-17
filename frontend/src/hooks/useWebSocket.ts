import { useEffect, useRef } from "react";
import {
  useEventStore,
  type CinemaEventType,
  type FlareEvent,
} from "../store/eventStore";
import { resolvePublicDeployConfig } from "../config/deployment";

const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000, 30000];

interface WsMessage {
  type?: string;
  payload?: unknown;
}

const CINEMA_EVENT_TYPES = new Set<CinemaEventType>([
  "claim.settled",
  "policy.created",
  "flight.landed",
  "claim.triggered",
]);

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeWsBaseUrl(value: string) {
  if (value.startsWith("https://")) return `wss://${value.slice("https://".length)}`;
  if (value.startsWith("http://")) return `ws://${value.slice("http://".length)}`;
  return value;
}

function makeWebSocketUrl(path: string) {
  const configuredBaseUrl = trimTrailingSlash(
    normalizeWsBaseUrl(resolvePublicDeployConfig().wsBaseUrl),
  );
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (configuredBaseUrl) return `${configuredBaseUrl}${normalizedPath}`;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${normalizedPath}`;
}

function parseWsMessage(data: MessageEvent["data"]): WsMessage | null {
  if (typeof data !== "string") return null;

  try {
    return JSON.parse(data) as WsMessage;
  } catch {
    return null;
  }
}

function isFlareEvent(payload: unknown): payload is FlareEvent {
  if (!payload || typeof payload !== "object") return false;

  const flare = payload as Record<string, unknown>;
  return (
    typeof flare.flight_id === "string" &&
    typeof flare.policy_id === "string" &&
    typeof flare.payout === "number" &&
    typeof flare.delay_minutes === "number" &&
    typeof flare.signature === "string" &&
    typeof flare.settle_duration_ms === "number"
  );
}

function isRecordPayload(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload);
}

function normalizeCinemaEventType(type: string | undefined): CinemaEventType | null {
  if (type === "flare" || type === "FLARE") return "flare";
  if (CINEMA_EVENT_TYPES.has(type as CinemaEventType)) {
    return type as CinemaEventType;
  }
  return null;
}

export function useWebSocket(path = "/ws") {
  const wsRef = useRef<WebSocket | null>(null);
  const stoppedRef = useRef(false);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;

      useEventStore.getState().setWsState("connecting");
      const ws = new WebSocket(makeWebSocketUrl(path));
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        useEventStore.getState().setWsState("open");
      };

      ws.onmessage = (event: MessageEvent) => {
        const msg = parseWsMessage(event.data);
        if (!msg) return;

        const cinemaEventType = normalizeCinemaEventType(msg.type);

        if (
          (msg.type === "flare" || msg.type === "FLARE") &&
          isFlareEvent(msg.payload)
        ) {
          useEventStore.getState().addFlare(msg.payload);
          useEventStore.getState().addEvent({
            type: "flare",
            payload: { ...msg.payload },
          });
        } else if (msg.type === "toast" && typeof msg.payload === "string") {
          const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          useEventStore.getState().addToast({ id, message: msg.payload });
          window.setTimeout(() => {
            useEventStore.getState().dismissToast(id);
          }, 4000);
        } else if (cinemaEventType && isRecordPayload(msg.payload)) {
          useEventStore.getState().addEvent({
            type: cinemaEventType,
            payload: msg.payload,
          });
        }
      };

      ws.onclose = () => {
        if (stoppedRef.current) return;

        useEventStore.getState().setWsState("retrying");
        const backoff =
          BACKOFF_SCHEDULE[
            Math.min(attemptRef.current, BACKOFF_SCHEDULE.length - 1)
          ];
        attemptRef.current += 1;
        retryTimerRef.current = window.setTimeout(connect, backoff);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
    };

    connect();

    return () => {
      stoppedRef.current = true;
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      wsRef.current?.close();
      useEventStore.getState().setWsState("closed");
    };
  }, [path]);
}
