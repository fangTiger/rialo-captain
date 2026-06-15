import { describe, expect, it } from "vitest";
import { projectLonLat } from "../components/cinema/cameraMath";
import {
  hangarAnchorForSize,
  projectMomentPoint,
  resolveLocator,
} from "../components/cinema/keyMomentGeometry";

const size = { width: 1200, height: 720 };
const viewport = { k: 4, x: -320, y: 80 };

describe("key moment geometry", () => {
  it("projects longitude and latitude through the current map viewport", () => {
    const point = projectMomentPoint(
      { kind: "coordinates", longitude: -73.78, latitude: 40.64 },
      size,
      viewport,
    );
    const projected = projectLonLat(-73.78, 40.64, size);

    expect(point).toEqual({
      x: projected.x * viewport.k + viewport.x,
      y: projected.y * viewport.k + viewport.y,
    });
  });

  it("uses deterministic airport IATA coordinates before projection", () => {
    const locator = resolveLocator({ kind: "airport", airportIata: "JFK" });
    const point = projectMomentPoint(locator, size, viewport);
    const projected = projectLonLat(-73.7781, 40.6413, size);

    expect(point).not.toBeNull();
    if (!point) throw new Error("JFK locator should project to a point");
    expect(point.x).toBeCloseTo(projected.x * viewport.k + viewport.x, 4);
    expect(point.y).toBeCloseTo(projected.y * viewport.k + viewport.y, 4);
  });

  it("returns null for unknown airport IATA locators", () => {
    expect(
      projectMomentPoint({ kind: "airport", airportIata: "ZZZ" }, size, viewport),
    ).toBeNull();
  });

  it("places the hangar anchor at the fixed upper-right visual anchor", () => {
    expect(hangarAnchorForSize(size)).toEqual({ x: 1104, y: 72 });
  });
});
