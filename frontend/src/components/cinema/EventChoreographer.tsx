import { useEffect, useRef } from "react";
import { useEventStore, type CinemaEvent } from "../../store/eventStore";
import { useCinema } from "./CinemaContext";
import {
  momentFromEvent,
  type ChainBeamMoment,
  type FlareLandMoment,
  type ShockWaveMoment,
} from "./keyMoments";
import type { RealProtagonistEvent } from "./protagonist";

function shouldTriggerKpiTick(event: CinemaEvent) {
  return event.type === "claim.settled" || event.type === "flare";
}

function realPolicyCreatedFromEvent(
  event: CinemaEvent,
): RealProtagonistEvent | null {
  if (event.type !== "policy.created") return null;

  const payload = event.payload;
  if (payload.source !== "real") return null;
  if (typeof payload.flight_id !== "string") return null;
  if (typeof payload.longitude !== "number") return null;
  if (typeof payload.latitude !== "number") return null;

  const callsign =
    typeof payload.callsign === "string" ? payload.callsign : payload.flight_id;
  const createdAt =
    typeof payload.created_at === "number" ? payload.created_at : event.receivedAt;

  return {
    id: event.id,
    flightId: payload.flight_id,
    callsign,
    longitude: payload.longitude,
    latitude: payload.latitude,
    createdAt,
    source: "real",
  };
}

export interface EventChoreographerProps {
  onClaimTriggered?: (moment: ShockWaveMoment) => void;
  onClaimSettled?: (moment: ChainBeamMoment) => void;
  onFlightLanded?: (moment: FlareLandMoment) => void;
  onPolicyCreated?: (event: CinemaEvent) => void;
}

function routeKeyMoment(event: CinemaEvent, callbacks: EventChoreographerProps) {
  if (
    event.type !== "claim.triggered" &&
    event.type !== "claim.settled" &&
    event.type !== "flight.landed"
  ) {
    return;
  }

  const moment = momentFromEvent(event);
  if (!moment) return;

  if (moment.kind === "shockwave") {
    callbacks.onClaimTriggered?.(moment);
  } else if (moment.kind === "chainbeam") {
    callbacks.onClaimSettled?.(moment);
  } else if (moment.kind === "flareland") {
    callbacks.onFlightLanded?.(moment);
  }
}

export function EventChoreographer({
  onClaimTriggered,
  onClaimSettled,
  onFlightLanded,
  onPolicyCreated,
}: EventChoreographerProps = {}) {
  const events = useEventStore((state) => state.events);
  const { markKpiTick, routeRealProtagonist } = useCinema();
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const chronologicalEvents = [...events].reverse();
    for (const event of chronologicalEvents) {
      if (seenIdsRef.current.has(event.id)) continue;
      seenIdsRef.current.add(event.id);

      if (shouldTriggerKpiTick(event)) {
        markKpiTick();
      }

      if (event.type === "policy.created") {
        onPolicyCreated?.(event);
      }

      const realPolicyCreated = realPolicyCreatedFromEvent(event);
      if (realPolicyCreated) {
        routeRealProtagonist(realPolicyCreated);
      }

      routeKeyMoment(event, {
        onClaimTriggered,
        onClaimSettled,
        onFlightLanded,
      });
    }
  }, [
    events,
    markKpiTick,
    onClaimSettled,
    onClaimTriggered,
    onFlightLanded,
    onPolicyCreated,
    routeRealProtagonist,
  ]);

  return null;
}
