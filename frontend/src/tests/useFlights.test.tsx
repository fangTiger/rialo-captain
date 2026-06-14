import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useFlights } from "../hooks/useFlights";

function Probe() {
  const { flights, stale, staleSeconds, isLoading } = useFlights();

  if (isLoading) return <div>loading</div>;

  return (
    <div>
      <div>flights:{flights.length}</div>
      <div>stale:{String(stale)}</div>
      <div>seconds:{staleSeconds}</div>
    </div>
  );
}

describe("useFlights", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches live flights and exposes stale metadata", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data_stale: false,
          stale_seconds: 0,
          flights: [
            {
              callsign: "BA178",
              origin_country: "United Kingdom",
              longitude: -73.78,
              latitude: 40.64,
              velocity: 240,
              heading: 90,
              on_ground: false,
            },
          ],
        }),
        { status: 200 },
      ),
    );

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("flights:1")).toBeInTheDocument());
    expect(screen.getByText("stale:false")).toBeInTheDocument();
    expect(screen.getByText("seconds:0")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/flights/live",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
