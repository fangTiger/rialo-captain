import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "../api/client";
import { InsureBlock } from "../components/flight/InsureBlock";
import { useEventStore } from "../store/eventStore";

const refreshPoliciesMock = vi.hoisted(() => vi.fn());
const refreshMeMock = vi.hoisted(() => vi.fn());

vi.mock("../api/client", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("../hooks/usePolicies", () => ({
  usePolicies: () => ({
    policies: [],
    refresh: refreshPoliciesMock,
  }),
}));

vi.mock("../hooks/useMe", () => ({
  useMe: () => ({
    user: null,
    refresh: refreshMeMock,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderInsureBlock(fromState: { from: string } | null) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/flight/BA178-20260614", state: fromState }]}
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Routes>
        <Route
          path="/flight/:id"
          element={
            <>
              <InsureBlock
                flightId="BA178-20260614"
                callsign="BA178"
                delayRate={0.25}
                hasActivePolicy={false}
                activePolicyCount={0}
              />
              <LocationProbe />
            </>
          }
        />
        <Route path="/policies" element={<LocationProbe />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("InsureBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue({});
    refreshPoliciesMock.mockResolvedValue(undefined);
    refreshMeMock.mockResolvedValue(undefined);
    useEventStore.setState({
      flares: [],
      toasts: [],
      events: [],
      wsState: "idle",
    });
  });

  it("shows a success toast and navigates back to location.state.from after BUY", async () => {
    renderInsureBlock({ from: "/policies" });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/policies$/),
    );
    expect(useEventStore.getState().toasts[0]).toMatchObject({
      message: "✓ Insured · BA178 · 10 RIA",
    });
  });

  it("navigates to tower when no source route is available", async () => {
    renderInsureBlock(null);

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/),
    );
  });
});
