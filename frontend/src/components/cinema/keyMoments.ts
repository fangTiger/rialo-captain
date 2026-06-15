import type { CinemaEvent } from "../../store/eventStore";

export type KeyMomentKind = "shockwave" | "chainbeam" | "flareland";

export type MomentDropReason =
  | "unsupported-event"
  | "invalid-event"
  | "missing-coordinates";

export interface MomentDrop {
  reason: MomentDropReason;
  detail: string;
}

export interface CoordinateLocator {
  kind: "coordinates";
  longitude: number;
  latitude: number;
}

export interface AirportLocator {
  kind: "airport";
  airportIata: string;
}

export type MomentLocator = CoordinateLocator | AirportLocator;

interface KeyMomentBase {
  id: string;
  eventId: string;
  kind: KeyMomentKind;
  flightId: string;
  policyId: string;
  receivedAt: number;
  source: string;
  locator?: MomentLocator;
}

export interface ShockWaveMoment extends KeyMomentBase {
  kind: "shockwave";
  delayMinutes: number;
  locator?: MomentLocator;
}

export interface ChainBeamMoment extends KeyMomentBase {
  kind: "chainbeam";
  txHash: string;
  shortTxHash: string;
}

export interface FlareLandMoment extends KeyMomentBase {
  kind: "flareland";
  landedAt: number;
}

export type KeyMoment = ShockWaveMoment | ChainBeamMoment | FlareLandMoment;

export type MomentParseResult =
  | { ok: true; moment: KeyMoment }
  | ({ ok: false } & MomentDrop);

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceValue(value: unknown) {
  return stringValue(value) ?? "mock";
}

function locatorFromPayload(payload: Record<string, unknown>): MomentLocator | null {
  const longitude = numberValue(payload.longitude);
  const latitude = numberValue(payload.latitude);
  if (longitude !== null && latitude !== null) {
    return { kind: "coordinates", longitude, latitude };
  }

  const airportLongitude = numberValue(payload.airport_longitude);
  const airportLatitude = numberValue(payload.airport_latitude);
  if (airportLongitude !== null && airportLatitude !== null) {
    return {
      kind: "coordinates",
      longitude: airportLongitude,
      latitude: airportLatitude,
    };
  }

  const airportIata = stringValue(payload.airport_iata);
  if (airportIata) {
    return { kind: "airport", airportIata };
  }

  return null;
}

function invalid(detail: string): MomentParseResult {
  return { ok: false, reason: "invalid-event", detail };
}

export function shortTxHash(txHash: string) {
  if (txHash.length <= 18) return txHash;
  return `${txHash.slice(0, 10)}...${txHash.slice(-6)}`;
}

export function parseMomentFromEvent(event: CinemaEvent): MomentParseResult {
  if (
    event.type !== "claim.triggered" &&
    event.type !== "claim.settled" &&
    event.type !== "flight.landed"
  ) {
    return {
      ok: false,
      reason: "unsupported-event",
      detail: `${event.type} is not a C2 key moment`,
    };
  }

  const payload = event.payload;
  const flightId = stringValue(payload.flight_id);
  const policyId = stringValue(payload.policy_id);

  if (event.type === "flight.landed") {
    if (!flightId || !policyId) {
      return invalid("flight.landed requires flight_id and policy_id");
    }

    return {
      ok: true,
      moment: {
        id: `${event.id}:flareland`,
        eventId: event.id,
        kind: "flareland",
        flightId,
        policyId,
        landedAt: numberValue(payload.landed_at) ?? event.receivedAt,
        receivedAt: event.receivedAt,
        source: sourceValue(payload.source),
        locator: locatorFromPayload(payload) ?? undefined,
      },
    };
  }

  if (event.type === "claim.settled") {
    const txHash = stringValue(payload.tx_hash);
    if (!flightId || !policyId || !txHash) {
      return invalid("claim.settled requires flight_id, policy_id and tx_hash");
    }

    return {
      ok: true,
      moment: {
        id: `${event.id}:chainbeam`,
        eventId: event.id,
        kind: "chainbeam",
        flightId,
        policyId,
        txHash,
        shortTxHash: shortTxHash(txHash),
        receivedAt: event.receivedAt,
        source: sourceValue(payload.source),
        locator: locatorFromPayload(payload) ?? undefined,
      },
    };
  }

  const delayMinutes = numberValue(payload.delay_minutes);

  if (!flightId || !policyId || delayMinutes === null) {
    return invalid(
      "claim.triggered requires flight_id, policy_id and delay_minutes",
    );
  }

  const locator = locatorFromPayload(payload);

  return {
    ok: true,
    moment: {
      id: `${event.id}:shockwave`,
      eventId: event.id,
      kind: "shockwave",
      flightId,
      policyId,
      delayMinutes,
      receivedAt: event.receivedAt,
      source: sourceValue(payload.source),
      ...(locator ? { locator } : {}),
    },
  };
}

export function momentFromEvent(event: CinemaEvent): KeyMoment | null {
  const result = parseMomentFromEvent(event);
  return result.ok ? result.moment : null;
}

export function explainMomentDrop(event: CinemaEvent): MomentDrop | null {
  const result = parseMomentFromEvent(event);
  if (result.ok) return null;
  return {
    reason: result.reason,
    detail: result.detail,
  };
}
