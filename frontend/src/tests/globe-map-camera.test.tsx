import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cameraTargetToViewport,
  projectLonLat,
} from "../components/cinema/cameraMath";
import type {
  CameraTarget,
  CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import { GlobeMap } from "../components/tower/GlobeMap";
import type { FlightPublic } from "../hooks/useFlights";

const flight: FlightPublic = {
  icao24: "a1b2c3",
  callsign: "BA178",
  origin_country: "United Kingdom",
  longitude: -73.78,
  latitude: 40.64,
  velocity: 240,
  heading: 90,
  on_ground: false,
};

const target: CameraTarget = {
  longitude: -73.78,
  latitude: 40.64,
  zoom: 5,
  durationMs: 1_000,
  reason: "protagonist",
};

const protagonistHighlight: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178-20260615",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

const size = { width: 1200, height: 720 };
const safeAreaInsets = {
  left: 500,
  right: 380,
  top: 260,
  bottom: 96,
};

let rafId = 0;
let rafCallbacks: Map<number, FrameRequestCallback>;

vi.mock("../hooks/useFlights", () => ({
  useFlights: () => ({
    flights: [flight],
    stale: false,
    staleSeconds: 0,
    error: undefined,
    isLoading: false,
  }),
}));

class MockResizeObserver {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe() {
    this.callback(
      [{ contentRect: { width: size.width, height: size.height } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
  unobserve() {}
}

function runNextFrame(timestamp: number) {
  const [id, callback] = Array.from(rafCallbacks.entries())[0];
  rafCallbacks.delete(id);
  act(() => {
    callback(timestamp);
  });
}

function runAnimationFrames(stepMs: number, frameCount: number) {
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (rafCallbacks.size === 0) break;
    runNextFrame(frame * stepMs);
  }
}

describe("GlobeMap spotlight and legacy camera target", () => {
  beforeEach(() => {
    rafId = 0;
    rafCallbacks = new Map();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        rafId += 1;
        rafCallbacks.set(rafId, callback);
        return rafId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((id: number) => {
        rafCallbacks.delete(id);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies cameraTarget to the existing viewport transform through RAF", () => {
    render(<GlobeMap cameraTarget={target} />);

    runNextFrame(0);
    runNextFrame(1_000);

    const expected = cameraTargetToViewport(target, size);
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${expected.x},${expected.y}) scale(${expected.k})`,
    );
  });

  it("lands safe-area camera targets on the unobstructed viewport anchor", () => {
    const safeAreaTarget = {
      ...target,
      safeAreaInsets,
    } as CameraTarget & { safeAreaInsets: typeof safeAreaInsets };

    render(<GlobeMap cameraTarget={safeAreaTarget} />);

    runNextFrame(0);
    runNextFrame(1_000);

    const point = projectLonLat(
      safeAreaTarget.longitude,
      safeAreaTarget.latitude,
      size,
    );
    const anchorX =
      safeAreaInsets.left +
      (size.width - safeAreaInsets.left - safeAreaInsets.right) / 2;
    const anchorY =
      safeAreaInsets.top +
      (size.height - safeAreaInsets.top - safeAreaInsets.bottom) / 2;

    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${anchorX - point.x * safeAreaTarget.zoom},${anchorY - point.y * safeAreaTarget.zoom}) scale(${safeAreaTarget.zoom})`,
    );
  });

  it("throttles long camera animations while still landing on the target viewport", () => {
    const onViewportChange = vi.fn();
    const longTarget: CameraTarget = {
      ...target,
      durationMs: 2_000,
    };

    render(
      <GlobeMap
        cameraTarget={longTarget}
        onViewportChange={onViewportChange}
      />,
    );

    runAnimationFrames(16, 130);

    const expected = cameraTargetToViewport(longTarget, size);
    expect(onViewportChange.mock.calls.length).toBeLessThanOrEqual(50);
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      `translate(${expected.x},${expected.y}) scale(${expected.k})`,
    );
  });

  it("exposes an e2e-stable protagonist selector without changing the global viewport", () => {
    render(<GlobeMap protagonistHighlight={protagonistHighlight} />);

    expect(screen.getByTestId("flight-dot-BA178")).toHaveAttribute(
      "data-protagonist",
      "true",
    );
    expect(screen.getByTestId("globe-viewport")).toHaveAttribute(
      "transform",
      "translate(0,0) scale(1)",
    );
  });

  it("cancels camera animation on user gestures while preserving flight click", () => {
    const onUserGesture = vi.fn();
    const onSelectFlight = vi.fn();
    render(
      <GlobeMap
        cameraTarget={target}
        onUserGesture={onUserGesture}
        onSelectFlight={onSelectFlight}
      />,
    );

    expect(rafCallbacks.size).toBe(1);

    fireEvent.wheel(screen.getByRole("img", { name: /global flight radar/i }), {
      deltaY: -1,
      clientX: 600,
      clientY: 360,
    });

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(rafCallbacks.size).toBe(0);

    fireEvent.mouseDown(screen.getByRole("img", { name: /global flight radar/i }), {
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.mouseMove(screen.getByRole("img", { name: /global flight radar/i }), {
      buttons: 1,
      clientX: 430,
      clientY: 320,
    });
    fireEvent.mouseUp(screen.getByRole("img", { name: /global flight radar/i }));

    expect(onUserGesture).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId("flight-dot-BA178"));

    expect(onUserGesture).toHaveBeenCalledTimes(3);
    expect(onSelectFlight).toHaveBeenCalledWith("BA178");
  });

  it("keeps protagonist highlight passive while the flight dot and map gestures stay interactive", () => {
    const onUserGesture = vi.fn();
    const onSelectFlight = vi.fn();
    render(
      <GlobeMap
        protagonistHighlight={protagonistHighlight}
        onUserGesture={onUserGesture}
        onSelectFlight={onSelectFlight}
      />,
    );

    expect(screen.getByTestId("protagonist-ring-BA178")).toHaveAttribute(
      "pointer-events",
      "none",
    );
    expect(screen.getByTestId("protagonist-ring-BA178")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByTestId("flight-dot-BA178"));

    expect(onUserGesture).toHaveBeenCalledTimes(1);
    expect(onSelectFlight).toHaveBeenCalledWith("BA178");

    fireEvent.wheel(screen.getByRole("img", { name: /global flight radar/i }), {
      deltaY: -1,
      clientX: 600,
      clientY: 360,
    });

    fireEvent.mouseDown(screen.getByRole("img", { name: /global flight radar/i }), {
      button: 0,
      clientX: 400,
      clientY: 300,
    });
    fireEvent.mouseMove(screen.getByRole("img", { name: /global flight radar/i }), {
      buttons: 1,
      clientX: 430,
      clientY: 320,
    });

    expect(onUserGesture).toHaveBeenCalledTimes(3);
  });

  it("renders protagonist highlight with CSS pulse animation and without runtime hooks", () => {
    render(<GlobeMap protagonistHighlight={protagonistHighlight} />);

    const ring = screen.getByTestId("protagonist-ring-BA178");
    const spotlightCircles = ring.querySelectorAll("circle");

    expect(spotlightCircles).toHaveLength(2);
    expect(ring).not.toHaveAttribute("data-framer-motion");
    expect(ring).not.toHaveAttribute("data-gsap");
    expect(spotlightCircles[0]).toHaveClass("protagonist-spotlight-ring-animated");
    expect(spotlightCircles[0]).toHaveStyle({
      animationName: "protagonist-spotlight-ring-breathe",
    });
    expect(spotlightCircles[1]).toHaveClass("protagonist-spotlight-pulse-animated");
    expect(spotlightCircles[1]).toHaveStyle({
      animationName: "protagonist-spotlight-pulse-expand",
    });
  });
});
