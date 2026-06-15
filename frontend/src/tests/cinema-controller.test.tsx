import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CinemaProvider,
  useCinema,
  type CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import { CinemaController } from "../components/cinema/CinemaController";
import { useEventStore } from "../store/eventStore";

const protagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178-20260614",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

function Probe() {
  const cinema = useCinema();
  return (
    <div>
      <div data-testid="mode">{cinema.mode}</div>
      <div data-testid="phase">{cinema.phase}</div>
      <div data-testid="cycle-id">{cinema.cycleId}</div>
      <div data-testid="manual-ms">{cinema.manualRemainingMs}</div>
      <div data-testid="camera-reason">
        {cinema.cameraTarget?.reason ?? "none"}
      </div>
      <div data-testid="camera-zoom">{cinema.cameraTarget?.zoom ?? "none"}</div>
      <div data-testid="camera-lon">
        {cinema.cameraTarget?.longitude ?? "none"}
      </div>
    </div>
  );
}

function renderCinema() {
  useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "open" });
  render(
    <CinemaProvider initialProtagonist={protagonist}>
      <CinemaController />
      <Probe />
    </CinemaProvider>,
  );
}

function expectState({
  phase,
  cycleId,
  cameraReason,
}: {
  phase: string;
  cycleId: string;
  cameraReason: string;
}) {
  expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
  expect(screen.getByTestId("phase")).toHaveTextContent(phase);
  expect(screen.getByTestId("cycle-id")).toHaveTextContent(cycleId);
  expect(screen.getByTestId("camera-reason")).toHaveTextContent(cameraReason);
}

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("CinemaProvider cycle state", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances the exact 30s spotlight cycle without viewport camera targets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    expectState({ phase: "establish", cycleId: "1", cameraReason: "none" });

    act(() => vi.advanceTimersByTime(5_000));
    expectState({ phase: "zoom-in", cycleId: "1", cameraReason: "none" });
    expect(screen.getByTestId("camera-zoom")).toHaveTextContent("none");
    expect(screen.getByTestId("camera-lon")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(2_000));
    expectState({ phase: "story", cycleId: "1", cameraReason: "none" });
    expect(screen.getByTestId("camera-zoom")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(18_000));
    expectState({ phase: "zoom-out", cycleId: "1", cameraReason: "none" });
    expect(screen.getByTestId("camera-zoom")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(2_000));
    expectState({ phase: "rest", cycleId: "1", cameraReason: "none" });

    act(() => vi.advanceTimersByTime(3_000));
    expectState({ phase: "establish", cycleId: "2", cameraReason: "none" });
  });

  it("keeps later cycles on the same phase timeline without restoring global zoom targets", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => vi.advanceTimersByTime(30_000));
    expectState({ phase: "establish", cycleId: "2", cameraReason: "none" });

    act(() => vi.advanceTimersByTime(25_000));
    expectState({ phase: "zoom-out", cycleId: "2", cameraReason: "none" });
    expect(screen.getByTestId("camera-zoom")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(2_000));
    expectState({ phase: "rest", cycleId: "2", cameraReason: "none" });

    act(() => vi.advanceTimersByTime(3_000));
    expectState({ phase: "establish", cycleId: "3", cameraReason: "none" });
  });

  it.each([
    ["click", () => window.dispatchEvent(new MouseEvent("click"))],
    ["wheel", () => window.dispatchEvent(new WheelEvent("wheel"))],
    [
      "drag",
      () => window.dispatchEvent(new MouseEvent("mousemove", { buttons: 1 })),
    ],
    ["keydown", () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "A" }))],
  ])("%s switches cinema into interactive mode with a 30s timer", (_, dispatch) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => dispatch());

    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("30000");
  });

  it("automatically resumes cinema after 30s idle and resets the cycle", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => window.dispatchEvent(new MouseEvent("click")));
    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");

    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
    expect(screen.getByTestId("phase")).toHaveTextContent("establish");
    expect(screen.getByTestId("cycle-id")).toHaveTextContent("2");
  });

  it("resets the manual countdown on repeated user input", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => window.dispatchEvent(new MouseEvent("click")));
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("10000");

    act(() => window.dispatchEvent(new WheelEvent("wheel")));

    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("30000");
  });

  it("Escape immediately resumes cinema without waiting for idle timeout", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => window.dispatchEvent(new MouseEvent("click")));
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("18000");

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
    expect(screen.getByTestId("phase")).toHaveTextContent("establish");
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("0");
  });

  it("mousemove without dragging does not switch out of cinema", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => window.dispatchEvent(new MouseEvent("mousemove", { buttons: 0 })));

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
    expect(screen.getByTestId("manual-ms")).toHaveTextContent("0");
  });

  it("pauses when hidden and resumes a fresh cinema cycle when visible", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByTestId("phase")).toHaveTextContent("zoom-in");

    act(() => setVisibilityState("hidden"));

    expect(screen.getByTestId("mode")).toHaveTextContent("paused-hidden");
    expect(screen.getByTestId("camera-reason")).toHaveTextContent("none");

    act(() => vi.advanceTimersByTime(30_000));

    expect(screen.getByTestId("mode")).toHaveTextContent("paused-hidden");
    expect(screen.getByTestId("phase")).toHaveTextContent("zoom-in");

    act(() => setVisibilityState("visible"));

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
    expect(screen.getByTestId("phase")).toHaveTextContent("establish");
    expect(screen.getByTestId("cycle-id")).toHaveTextContent("2");
  });

  it("degrades during websocket retry and resumes cinema after reconnect", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");

    act(() => {
      useEventStore.setState({ wsState: "retrying" });
    });

    expect(screen.getByTestId("mode")).toHaveTextContent("degraded");

    act(() => {
      useEventStore.setState({ wsState: "open" });
    });

    expect(screen.getByTestId("mode")).toHaveTextContent("cinema");
    expect(screen.getByTestId("phase")).toHaveTextContent("establish");
  });

  it("keeps manual mode across websocket retry and reconnect", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderCinema();

    act(() => window.dispatchEvent(new MouseEvent("click")));
    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");

    act(() => {
      useEventStore.setState({ wsState: "retrying" });
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");

    act(() => {
      useEventStore.setState({ wsState: "open" });
    });
    expect(screen.getByTestId("mode")).toHaveTextContent("interactive");
  });
});
