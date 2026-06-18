import { describe, expect, it } from "vitest";
import { projectLonLat } from "../components/cinema/cameraMath";
import {
  buildTrailPoints,
  projectTrailPoints,
} from "../components/cinema/trailGeometry";

function screenPathLength(points: Array<{ x: number; y: number }>) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

describe("trail geometry", () => {
  it("generates a multi-point trail from heading and ends at the protagonist", () => {
    const points = buildTrailPoints({
      longitude: -73.78,
      latitude: 40.64,
      heading: 90,
      velocity: 240,
    });

    expect(points).not.toBeNull();
    if (!points) throw new Error("heading-based trail should be available");
    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(points.at(-1)).toEqual({ longitude: -73.78, latitude: 40.64 });
    expect(points[0].longitude).toBeLessThan(points.at(-1)?.longitude ?? 0);
  });

  it("uses a deterministic fallback path when heading is missing", () => {
    const points = buildTrailPoints({
      longitude: -73.78,
      latitude: 40.64,
      velocity: 240,
    });

    expect(points).not.toBeNull();
    if (!points) throw new Error("fallback trail should be available");
    expect(points).toHaveLength(4);
    expect(points[0].longitude).toBeLessThan(points.at(-1)?.longitude ?? 0);
    expect(points[0].latitude).toBeLessThan(points.at(-1)?.latitude ?? 0);
    expect(points.at(-1)).toEqual({ longitude: -73.78, latitude: 40.64 });
  });

  it("returns null for invalid coordinates", () => {
    expect(
      buildTrailPoints({ longitude: null, latitude: 40.64, heading: 90 }),
    ).toBeNull();
    expect(
      projectTrailPoints(
        null,
        { width: 1200, height: 720 },
        { k: 1, x: 0, y: 0 },
      ),
    ).toBeNull();
  });

  it("projects trail coordinates through the current map viewport", () => {
    const size = { width: 1200, height: 720 };
    const viewport = { k: 3, x: -100, y: 25 };
    const points = [
      { longitude: -74, latitude: 40 },
      { longitude: -73.78, latitude: 40.64 },
    ];

    const projected = projectTrailPoints(points, size, viewport);
    const first = projectLonLat(points[0].longitude, points[0].latitude, size);

    expect(projected?.[0]).toEqual({
      x: first.x * viewport.k + viewport.x,
      y: first.y * viewport.k + viewport.y,
    });
  });

  it("can expand short global trails to a minimum visible screen length", () => {
    const size = { width: 1280, height: 720 };
    const viewport = { k: 1, x: 0, y: 0 };
    const points = buildTrailPoints({
      longitude: -73.78,
      latitude: 40.64,
      heading: 90,
      velocity: 240,
    });
    if (!points) throw new Error("trail should be available");

    const natural = projectTrailPoints(points, size, viewport);
    const visible = projectTrailPoints(points, size, viewport, {
      minVisibleLengthPx: 56,
    });

    if (!natural || !visible) throw new Error("trail projection should exist");
    expect(screenPathLength(natural)).toBeLessThan(10);
    expect(screenPathLength(visible)).toBeGreaterThanOrEqual(56);
    expect(visible.at(-1)).toEqual(natural.at(-1));
  });
});
