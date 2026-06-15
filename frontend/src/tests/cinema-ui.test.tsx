import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CinemaProvider,
  type CinemaProtagonist,
  useCinema,
} from "../components/cinema/CinemaContext";
import { CinemaController } from "../components/cinema/CinemaController";
import { CinemaOverlay } from "../components/cinema/CinemaOverlay";
import { ModeIndicator } from "../components/cinema/ModeIndicator";
import { ProtagonistBadge } from "../components/cinema/ProtagonistBadge";
import { useEventStore } from "../store/eventStore";

const protagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

const realEvent = {
  id: "policy-real-1",
  flightId: "UA200-20260615",
  callsign: "UA200",
  longitude: -118.4,
  latitude: 33.94,
  createdAt: new Date("2026-06-15T00:00:00.000Z").getTime(),
  source: "real" as const,
};

function renderModeIndicator() {
  render(
    <CinemaProvider initialProtagonist={protagonist}>
      <CinemaController />
      <ModeIndicator />
    </CinemaProvider>,
  );
}

function renderBadge(
  badgeProtagonist: CinemaProtagonist | null,
  queuedCount = 0,
) {
  render(
    <CinemaProvider initialProtagonist={badgeProtagonist}>
      <ProtagonistBadge queuedCount={queuedCount} />
    </CinemaProvider>,
  );
}

function RealTakeoverButton() {
  const cinema = useCinema();
  return (
    <button
      type="button"
      onClick={() => cinema.routeRealProtagonist(realEvent)}
    >
      route real
    </button>
  );
}

describe("cinema UI", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], events: [], wsState: "open" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows CINEMA while automatic playback is active", () => {
    renderModeIndicator();

    expect(screen.getByTestId("mode-indicator")).toHaveTextContent("CINEMA");
    expect(screen.getByTestId("mode-indicator-state")).toHaveTextContent(
      "cinema",
    );
  });

  it("shows waiting for aircraft when cinema has no protagonist", () => {
    render(
      <CinemaProvider>
        <ModeIndicator />
      </CinemaProvider>,
    );

    expect(screen.getByTestId("mode-indicator")).toHaveTextContent(
      "CINEMA · WAITING FOR AIRCRAFT",
    );
  });

  it("shows MANUAL countdown and updates the remaining seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    renderModeIndicator();

    act(() => {
      fireEvent.click(window);
    });

    expect(screen.getByTestId("mode-indicator")).toHaveTextContent(
      "MANUAL · 30s",
    );

    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByTestId("mode-indicator")).toHaveTextContent(
      "MANUAL · 29s",
    );
  });

  it("shows data link loss above cinema/manual state when websocket retries", () => {
    useEventStore.setState({ wsState: "retrying" });

    renderModeIndicator();

    expect(screen.getByTestId("mode-indicator")).toHaveTextContent(
      "DATA LINK LOST · retry",
    );
    expect(screen.getByTestId("mode-indicator-state")).toHaveTextContent(
      "data-link-lost",
    );
  });

  it.each([
    [{ ...protagonist, kind: "DEMO" as const }, "DEMO"],
    [{ ...protagonist, kind: "DEMO_OFFLINE" as const }, "DEMO · OFFLINE"],
    [{ ...protagonist, kind: "REAL" as const }, "REAL · LIVE"],
  ])("shows protagonist badge state %s", (badgeProtagonist, label) => {
    renderBadge(badgeProtagonist);

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(label);
    expect(screen.getByRole("status", { name: new RegExp(label) })).toBeVisible();
  });

  it("shows queued protagonist backlog as +N more", () => {
    renderBadge(protagonist, 2);

    expect(screen.getByTestId("protagonist-queue-count")).toHaveTextContent(
      "+2 more",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("+2 more"),
    );
  });

  it("shows REAL live badge after a routed real policy event takes over", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

    render(
      <CinemaProvider initialProtagonist={protagonist}>
        <ProtagonistBadge />
        <RealTakeoverButton />
      </CinemaProvider>,
    );

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("DEMO");

    fireEvent.click(screen.getByRole("button", { name: /route real/i }));

    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent(
      "REAL · LIVE",
    );
    expect(screen.getByTestId("protagonist-badge")).toHaveTextContent("UA200");
  });

  it("keeps CinemaOverlay non-interactive so map clicks remain available", () => {
    const onMapClick = vi.fn();

    render(
      <div>
        <button type="button" onClick={onMapClick}>
          map click target
        </button>
        <CinemaOverlay>
          <ProtagonistBadge protagonist={protagonist} />
        </CinemaOverlay>
      </div>,
    );

    expect(screen.getByTestId("cinema-overlay")).toHaveStyle({
      pointerEvents: "none",
    });

    fireEvent.click(screen.getByRole("button", { name: /map click target/i }));

    expect(onMapClick).toHaveBeenCalledTimes(1);
  });
});
