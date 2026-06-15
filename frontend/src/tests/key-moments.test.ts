import { describe, expect, it } from "vitest";
import {
  explainMomentDrop,
  momentFromEvent,
  parseMomentFromEvent,
} from "../components/cinema/keyMoments";
import type { CinemaEvent } from "../store/eventStore";

const receivedAt = new Date("2026-06-15T00:00:12.000Z").getTime();

function event(
  type: CinemaEvent["type"],
  payload: Record<string, unknown>,
  id = `${type}-1`,
): CinemaEvent {
  return {
    id,
    type,
    payload,
    receivedAt,
  };
}

describe("key moment event parsing", () => {
  it("normalizes claim.triggered into a shockwave moment", () => {
    const moment = momentFromEvent(
      event("claim.triggered", {
        flight_id: "BA178-20260615",
        policy_id: "pol-1",
        delay_minutes: 45,
        airport_iata: "JFK",
        source: "mock",
      }),
    );

    expect(moment).toMatchObject({
      id: "claim.triggered-1:shockwave",
      eventId: "claim.triggered-1",
      kind: "shockwave",
      flightId: "BA178-20260615",
      policyId: "pol-1",
      delayMinutes: 45,
      receivedAt,
      source: "mock",
      locator: { kind: "airport", airportIata: "JFK" },
    });
  });

  it("returns null for invalid claim.triggered and exposes invalid-event reason", () => {
    const badEvent = event("claim.triggered", {
      flight_id: "BA178-20260615",
      delay_minutes: 45,
      airport_iata: "JFK",
    });

    expect(momentFromEvent(badEvent)).toBeNull();
    expect(explainMomentDrop(badEvent)).toEqual({
      reason: "invalid-event",
      detail: "claim.triggered requires flight_id, policy_id and delay_minutes",
    });
    expect(parseMomentFromEvent(badEvent)).toEqual({
      ok: false,
      reason: "invalid-event",
      detail: "claim.triggered requires flight_id, policy_id and delay_minutes",
    });
  });

  it("normalizes claim.triggered without locator for protagonist fallback", () => {
    const moment = momentFromEvent(event("claim.triggered", {
      flight_id: "BA178-20260615",
      policy_id: "pol-1",
      delay_minutes: 45,
      source: "mock",
    }));

    expect(moment).toMatchObject({
      id: "claim.triggered-1:shockwave",
      eventId: "claim.triggered-1",
      kind: "shockwave",
      flightId: "BA178-20260615",
      policyId: "pol-1",
      delayMinutes: 45,
      receivedAt,
      source: "mock",
    });
    expect(moment).not.toHaveProperty("locator");
  });

  it("normalizes claim.settled into a chainbeam moment with short tx hash", () => {
    const moment = momentFromEvent(
      event("claim.settled", {
        flight_id: "BA178-20260615",
        policy_id: "pol-1",
        payout: 320,
        tx_hash: "0x1234567890abcdef1234567890abcdef12345678",
        source: "mock",
      }),
      );

    expect(moment).toMatchObject({
      id: "claim.settled-1:chainbeam",
      eventId: "claim.settled-1",
      kind: "chainbeam",
      flightId: "BA178-20260615",
      policyId: "pol-1",
      txHash: "0x1234567890abcdef1234567890abcdef12345678",
      shortTxHash: "0x12345678...345678",
      source: "mock",
    });
  });

  it("uses event id for settled moment identity even when payout is unchanged", () => {
    const first = momentFromEvent(
      event(
        "claim.settled",
        {
          flight_id: "BA178-20260615",
          policy_id: "pol-1",
          payout: 320,
          tx_hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        "settled-a",
      ),
    );
    const second = momentFromEvent(
      event(
        "claim.settled",
        {
          flight_id: "BA178-20260615",
          policy_id: "pol-1",
          payout: 320,
          tx_hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
        "settled-b",
      ),
    );

    expect(first?.id).toBe("settled-a:chainbeam");
    expect(second?.id).toBe("settled-b:chainbeam");
  });

  it("normalizes flight.landed into a flareland moment", () => {
    const moment = momentFromEvent(
      event("flight.landed", {
        flight_id: "BA178-20260615",
        policy_id: "pol-1",
        landed_at: 1_800_000_000,
        source: "mock",
      }),
    );

    expect(moment).toMatchObject({
      id: "flight.landed-1:flareland",
      eventId: "flight.landed-1",
      kind: "flareland",
      flightId: "BA178-20260615",
      policyId: "pol-1",
      landedAt: 1_800_000_000,
      receivedAt,
      source: "mock",
    });
  });

  it("ignores invalid flight.landed payloads with missing flight or policy", () => {
    const badEvent = event("flight.landed", {
      flight_id: "BA178-20260615",
      landed_at: 1_800_000_000,
    });

    expect(momentFromEvent(badEvent)).toBeNull();
    expect(explainMomentDrop(badEvent)).toEqual({
      reason: "invalid-event",
      detail: "flight.landed requires flight_id and policy_id",
    });
  });
});
