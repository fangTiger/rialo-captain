import { describe, expect, it } from "vitest";
import {
  capHeatPoints,
  heatPointFromPolicyEvent,
  pruneHeatPoints,
  selectHeatmapFocusPoints,
  type HeatPoint,
} from "../components/cinema/ambientHeatmap";
import type { CinemaEvent } from "../store/eventStore";

const receivedAt = new Date("2026-06-15T00:00:12.000Z").getTime();

function event(
  payload: Record<string, unknown>,
  id = "policy-created-1",
): CinemaEvent {
  return {
    id,
    type: "policy.created",
    payload,
    receivedAt,
  };
}

function point(index: number, createdAt = receivedAt): HeatPoint {
  return {
    id: `point-${index}`,
    eventId: `event-${index}`,
    policyId: `pol-${index}`,
    flightId: `flight-${index}`,
    longitude: -120 + index,
    latitude: 30 + index / 10,
    createdAt,
    weight: 1,
    source: "real",
  };
}

describe("ambient heatmap event parsing", () => {
  it("converts a valid policy.created event into a heat point", () => {
    const point = heatPointFromPolicyEvent(
      event({
        policy_id: "pol-1",
        flight_id: "BA178-20260615",
        longitude: -73.78,
        latitude: 40.64,
        created_at: receivedAt / 1000,
        source: "real",
      }),
    );

    expect(point).toEqual({
      id: "policy-created-1:heat",
      eventId: "policy-created-1",
      policyId: "pol-1",
      flightId: "BA178-20260615",
      longitude: -73.78,
      latitude: 40.64,
      createdAt: receivedAt,
      weight: 1,
      source: "real",
    });
  });

  it("returns null for policy.created without coordinates", () => {
    expect(
      heatPointFromPolicyEvent(
        event({
          policy_id: "pol-1",
          flight_id: "BA178-20260615",
          source: "real",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for invalid longitude or latitude", () => {
    expect(
      heatPointFromPolicyEvent(
        event({
          policy_id: "pol-1",
          flight_id: "BA178-20260615",
          longitude: -190,
          latitude: 40.64,
          source: "real",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for duplicate event ids", () => {
    expect(
      heatPointFromPolicyEvent(
        event({
          policy_id: "pol-1",
          flight_id: "BA178-20260615",
          longitude: -73.78,
          latitude: 40.64,
          source: "real",
        }),
        new Set(["policy-created-1"]),
      ),
    ).toBeNull();
  });

  it("prunes points outside the five minute lookback window", () => {
    const now = receivedAt + 300_000;

    expect(
      pruneHeatPoints(
        [
          point(1, now - 300_001),
          point(2, now - 300_000),
          point(3, now - 1_000),
        ],
        now,
      ).map((heatPoint) => heatPoint.id),
    ).toEqual(["point-2", "point-3"]);
  });

  it("caps raw and focus heatmap points to the latest entries", () => {
    const points = Array.from({ length: 130 }, (_, index) => point(index));

    expect(capHeatPoints(points).map((heatPoint) => heatPoint.id).slice(0, 3)).toEqual([
      "point-10",
      "point-11",
      "point-12",
    ]);
    expect(capHeatPoints(points)).toHaveLength(120);

    expect(selectHeatmapFocusPoints(points)).toHaveLength(32);
    expect(selectHeatmapFocusPoints(points)[0].id).toBe("point-98");
  });
});
