import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import {
  CinemaProvider,
  useCinema,
  type CinemaProtagonist,
} from "../components/cinema/CinemaContext";
import { CinemaController } from "../components/cinema/CinemaController";
import type { CinemaMode } from "../components/cinema/cinemaMachine";
import { AutoSeeder } from "../components/cinema/AutoSeeder";
import { chooseDemoProtagonist } from "../components/cinema/protagonist";

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

const liveFlights = [
  {
    callsign: "BA178",
    longitude: -73.78,
    latitude: 40.64,
    on_ground: false,
    etaMinutes: 9,
  },
];

const initialProtagonist: CinemaProtagonist = {
  kind: "DEMO",
  flightId: "BA178",
  callsign: "BA178",
  longitude: -73.78,
  latitude: 40.64,
  name: "Alice",
};

function ProtagonistProbe() {
  const cinema = useCinema();
  return <div data-testid="protagonist-kind">{cinema.protagonist?.kind}</div>;
}

function renderAutoSeeder(initialMode?: CinemaMode) {
  return render(
    <CinemaProvider initialMode={initialMode}>
      <CinemaController />
      <AutoSeeder flights={liveFlights} />
    </CinemaProvider>,
  );
}

function renderAutoSeederWithProbe() {
  return render(
    <CinemaProvider initialProtagonist={initialProtagonist}>
      <CinemaController />
      <AutoSeeder flights={liveFlights} />
      <ProtagonistProbe />
    </CinemaProvider>,
  );
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("chooseDemoProtagonist", () => {
  it("selects the first airborne flight with coordinates and a suitable ETA", () => {
    const protagonist = chooseDemoProtagonist(
      [
        {
          callsign: "LANDED",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: true,
          etaMinutes: 8,
        },
        {
          callsign: "NOCOORD",
          longitude: null,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 8,
        },
        {
          callsign: "EARLY",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 3,
        },
        {
          callsign: "LATE",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 25,
        },
        {
          callsign: "BA178",
          longitude: -73.78,
          latitude: 40.64,
          on_ground: false,
          etaMinutes: 9,
        },
      ],
      0,
    );

    expect(protagonist).toMatchObject({
      kind: "DEMO",
      flightId: "BA178",
      callsign: "BA178",
      longitude: -73.78,
      latitude: 40.64,
      name: "Alice",
    });
  });

  it("accepts flights without ETA because the current live API does not expose ETA", () => {
    const protagonist = chooseDemoProtagonist(
      [
        {
          callsign: "UA200",
          longitude: -0.45,
          latitude: 51.47,
          on_ground: false,
        },
      ],
      1,
    );

    expect(protagonist).toMatchObject({
      callsign: "UA200",
      name: "Bob",
    });
  });

  it("returns null when every flight is landed, unpositioned, or outside ETA window", () => {
    const protagonist = chooseDemoProtagonist([
      {
        callsign: "GROUND",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: true,
        etaMinutes: 10,
      },
      {
        callsign: "MISSING",
        longitude: 2.35,
        latitude: null,
        on_ground: false,
        etaMinutes: 10,
      },
      {
        callsign: "TOOFAST",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: false,
        etaMinutes: 2,
      },
      {
        callsign: "TOOSLOW",
        longitude: 2.35,
        latitude: 48.85,
        on_ground: false,
        etaMinutes: 30,
      },
    ]);

    expect(protagonist).toBeNull();
  });
});

describe("AutoSeeder", () => {
  afterEach(() => {
    vi.useRealTimers();
    apiFetchMock.mockReset();
  });

  it("seeds during establish and injects delay at the 12s mark", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    renderAutoSeeder();
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, "/seed-demo", {
      method: "POST",
      body: JSON.stringify({
        user_email: "captain@local.dev",
        protagonist_name: "Alice",
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(12_000);
      await Promise.resolve();
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, "/inject-delay", {
      method: "POST",
      body: JSON.stringify({
        flight_id: "BA178-20260615",
        delay_minutes: 45,
      }),
    });
  });

  it("dedupes seed and inject by cycleId across React rerenders", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockResolvedValueOnce({
      protagonist_name: "Alice",
      flight_id: "BA178-20260615",
      policy_ids: ["p1"],
      policies_created: 1,
      claims_settled: 0,
    });
    apiFetchMock.mockResolvedValueOnce({
      flight_id: "BA178-20260615",
      delay_minutes: 45,
    });

    const { rerender } = renderAutoSeeder();
    await flushPromises();

    rerender(
      <CinemaProvider>
        <CinemaController />
        <AutoSeeder flights={[...liveFlights]} />
      </CinemaProvider>,
    );
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(12_000);
      await Promise.resolve();
    });
    rerender(
      <CinemaProvider>
        <CinemaController />
        <AutoSeeder flights={[...liveFlights]} />
      </CinemaProvider>,
    );
    await flushPromises();

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(["interactive", "paused-hidden", "degraded"] as const)(
    "does not call APIs while mode is %s",
    async (mode) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));

      renderAutoSeeder(mode);
      await flushPromises();
      await act(async () => {
        vi.advanceTimersByTime(12_000);
        await Promise.resolve();
      });

      expect(apiFetchMock).not.toHaveBeenCalled();
    },
  );

  it("marks the current demo protagonist offline when seed-demo fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00.000Z"));
    apiFetchMock.mockRejectedValueOnce(new Error("seed unavailable"));

    renderAutoSeederWithProbe();
    await flushPromises();

    expect(screen.getByTestId("protagonist-kind")).toHaveTextContent(
      "DEMO_OFFLINE",
    );
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
