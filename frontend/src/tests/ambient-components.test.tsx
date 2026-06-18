import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HeatmapBg } from "../components/cinema/HeatmapBg";
import { TrailDraw } from "../components/cinema/TrailDraw";
import { projectLonLat } from "../components/cinema/cameraMath";
import type { HeatPoint } from "../components/cinema/ambientHeatmap";

const size = { width: 1200, height: 720 };
const viewport = { k: 1, x: 0, y: 0 };
const originalMatchMedia = window.matchMedia;

function heatPoint(index: number): HeatPoint {
  return {
    id: `heat-${index}`,
    eventId: `event-${index}`,
    policyId: `policy-${index}`,
    flightId: `flight-${index}`,
    longitude: -73.78 + index * 0.1,
    latitude: 40.64 + index * 0.05,
    createdAt: 1_779_926_400_000 + index,
    weight: 1,
    source: "real",
  };
}

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

function installMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("C3 ambient visual components", () => {
  it("renders HeatmapBg as SVG radial gradients without canvas", () => {
    const { container } = render(
      <HeatmapBg points={[heatPoint(1), heatPoint(2)]} size={size} viewport={viewport} />,
    );

    const heatmap = screen.getByTestId("heatmap-bg");
    expect(heatmap.tagName.toLowerCase()).toBe("svg");
    expect(container.querySelectorAll("radialGradient")).toHaveLength(3);
    expect(container.querySelector("#heatmap-baseline-gradient")).toBeInTheDocument();
    expect(screen.getAllByTestId("heatmap-focus")).toHaveLength(2);
    expect(container.querySelector("canvas")).not.toBeInTheDocument();
  });

  it("keeps a baseline HeatmapBg glow visible when no policy points exist", () => {
    render(<HeatmapBg points={[]} size={size} viewport={viewport} />);

    expect(screen.getByTestId("heatmap-bg")).toBeInTheDocument();
    expect(screen.getAllByTestId("heatmap-base-focus")).toHaveLength(3);
    expect(screen.queryAllByTestId("heatmap-focus")).toHaveLength(0);
  });

  it("caps HeatmapBg focus nodes and projects them through the viewport", () => {
    const projected = projectLonLat(-73.78 + 98 * 0.1, 40.64 + 98 * 0.05, size);
    const shiftedViewport = { k: 2, x: -120, y: 40 };

    render(
      <HeatmapBg
        points={Array.from({ length: 130 }, (_, index) => heatPoint(index))}
        size={size}
        viewport={shiftedViewport}
      />,
    );

    expect(screen.getByTestId("heatmap-bg")).toHaveStyle({
      pointerEvents: "none",
    });
    const focusNodes = screen.getAllByTestId("heatmap-focus");
    expect(focusNodes.length).toBe(32);
    expect(focusNodes[0]).toHaveAttribute(
      "cx",
      String(projected.x * shiftedViewport.k + shiftedViewport.x),
    );
    expect(focusNodes[0]).toHaveAttribute(
      "cy",
      String(projected.y * shiftedViewport.k + shiftedViewport.y),
    );
  });

  it("renders HeatmapBg static when prefers-reduced-motion is enabled", () => {
    installMatchMedia(true);

    render(<HeatmapBg points={[heatPoint(1)]} size={size} viewport={viewport} />);

    const heatmap = screen.getByTestId("heatmap-bg");
    expect(heatmap).toHaveClass("is-reduced-motion");
    expect(heatmap).not.toHaveClass("heatmap-bg-breath");
    expect(screen.getByTestId("heatmap-focus-layer")).toHaveStyle({
      animation: "none",
    });
  });

  it("renders TrailDraw as an animated SVG path", () => {
    render(
      <TrailDraw
        points={[
          { x: 120, y: 240 },
          { x: 180, y: 210 },
          { x: 260, y: 190 },
        ]}
      />,
    );

    const trail = screen.getByTestId("trail-draw");
    expect(trail.tagName.toLowerCase()).toBe("svg");
    expect(trail).toHaveAttribute("width", "100%");
    expect(trail).toHaveAttribute("height", "100%");
    expect(trail).toHaveStyle({ pointerEvents: "none" });

    const path = screen.getByTestId("trail-draw-path");
    expect(path).toHaveAttribute("d", "M 120 240 L 180 210 L 260 190");
    expect(path).toHaveClass("traildraw-path-animated");
    expect(path).toHaveStyle({
      animationName: "traildraw-dash-reveal",
      strokeDasharray: "100",
    });
  });

  it("renders TrailDraw as a complete static path in reduced motion", () => {
    installMatchMedia(true);

    render(
      <TrailDraw
        points={[
          { x: 120, y: 240 },
          { x: 180, y: 210 },
          { x: 260, y: 190 },
        ]}
      />,
    );

    const trail = screen.getByTestId("trail-draw");
    expect(trail).toHaveClass("is-reduced-motion");

    const path = screen.getByTestId("trail-draw-path");
    expect(path).toHaveClass("traildraw-path-static");
    expect(path).not.toHaveClass("traildraw-path-animated");
    expect(path).toHaveStyle({ animation: "none" });
    expect(path).not.toHaveStyle({ strokeDashoffset: "100" });
  });
});
