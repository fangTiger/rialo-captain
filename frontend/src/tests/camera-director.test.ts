import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CameraDirector } from "../components/cinema/CameraDirector";
import {
  cameraTargetToViewport,
  projectLonLat,
} from "../components/cinema/cameraMath";
import type { CameraTarget } from "../components/cinema/CinemaContext";

const cinemaContextMock = vi.hoisted(() => ({
  cameraTarget: null as CameraTarget | null,
}));

vi.mock("../components/cinema/CinemaContext", () => ({
  useCinema: () => ({
    cameraTarget: cinemaContextMock.cameraTarget,
  }),
}));

const size = { width: 1200, height: 720 };
const safeAreaInsets = {
  left: 500,
  right: 380,
  top: 260,
  bottom: 96,
};

describe("CameraDirector spotlight compatibility", () => {
  beforeEach(() => {
    cinemaContextMock.cameraTarget = null;
  });

  it("passes the default null camera target to children", () => {
    render(
      createElement(CameraDirector, {
        children: (cameraTarget) =>
          createElement(
            "div",
            { "data-testid": "camera-director-target" },
            cameraTarget?.reason ?? "none",
          ),
      }),
    );

    expect(screen.getByTestId("camera-director-target")).toHaveTextContent(
      "none",
    );
  });

  it("keeps passing an explicit legacy camera target from context", () => {
    cinemaContextMock.cameraTarget = {
      longitude: -73.78,
      latitude: 40.64,
      zoom: 5,
      durationMs: 2_000,
      reason: "protagonist",
    };

    render(
      createElement(CameraDirector, {
        children: (cameraTarget) =>
          createElement(
            "div",
            { "data-testid": "camera-director-target" },
            `${cameraTarget?.reason ?? "none"}:${cameraTarget?.zoom ?? "none"}`,
          ),
      }),
    );

    expect(screen.getByTestId("camera-director-target")).toHaveTextContent(
      "protagonist:5",
    );
  });
});

describe("legacy cameraMath viewport conversion", () => {
  it("converts protagonist longitude, latitude and zoom into a centered viewport", () => {
    const target: CameraTarget = {
      longitude: -73.78,
      latitude: 40.64,
      zoom: 5,
      durationMs: 2_000,
      reason: "protagonist",
    };

    const point = projectLonLat(target.longitude, target.latitude, size);
    const viewport = cameraTargetToViewport(target, size);

    expect(viewport.k).toBe(5);
    expect(viewport.x).toBeCloseTo(size.width / 2 - point.x * viewport.k, 4);
    expect(viewport.y).toBeCloseTo(size.height / 2 - point.y * viewport.k, 4);
    expect(point.x * viewport.k + viewport.x).toBeCloseTo(size.width / 2, 4);
    expect(point.y * viewport.k + viewport.y).toBeCloseTo(size.height / 2, 4);
  });

  it("anchors protagonist targets to the safe-area center when insets are provided", () => {
    const target = {
      longitude: -73.78,
      latitude: 40.64,
      zoom: 5,
      durationMs: 2_000,
      reason: "protagonist",
      safeAreaInsets,
    } as CameraTarget & { safeAreaInsets: typeof safeAreaInsets };

    const point = projectLonLat(target.longitude, target.latitude, size);
    const viewport = cameraTargetToViewport(target, size);
    const safeCenterX =
      safeAreaInsets.left +
      (size.width - safeAreaInsets.left - safeAreaInsets.right) / 2;
    const safeCenterY =
      safeAreaInsets.top +
      (size.height - safeAreaInsets.top - safeAreaInsets.bottom) / 2;

    expect(point.x * viewport.k + viewport.x).toBeCloseTo(safeCenterX, 4);
    expect(point.y * viewport.k + viewport.y).toBeCloseTo(safeCenterY, 4);
  });

  it("falls back to viewport center when safe-area insets overlap the viewport", () => {
    const compactSize = { width: 840, height: 300 };
    const target = {
      longitude: -73.78,
      latitude: 40.64,
      zoom: 5,
      durationMs: 2_000,
      reason: "protagonist",
      safeAreaInsets,
    } as CameraTarget & { safeAreaInsets: typeof safeAreaInsets };

    const point = projectLonLat(target.longitude, target.latitude, compactSize);
    const viewport = cameraTargetToViewport(target, compactSize);

    expect(point.x * viewport.k + viewport.x).toBeCloseTo(
      compactSize.width / 2,
      4,
    );
    expect(point.y * viewport.k + viewport.y).toBeCloseTo(
      compactSize.height / 2,
      4,
    );
  });

  it("returns the global viewport when camera target zooms out", () => {
    const viewport = cameraTargetToViewport(
      {
        longitude: 0,
        latitude: 0,
        zoom: 1,
        durationMs: 2_000,
        reason: "global",
      },
      size,
    );

    expect(viewport).toEqual({ k: 1, x: 0, y: 0 });
  });
});
