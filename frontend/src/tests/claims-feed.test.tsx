import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimsFeed } from "../routes/ClaimsFeed";
import { useEventStore } from "../store/eventStore";

vi.mock("../components/evidence/EvidenceDrawer", () => ({
  EvidenceDrawer: ({
    subject,
    onClose,
  }: {
    subject: { kind: string; id: string } | null;
    onClose: () => void;
  }) =>
    subject ? (
      <div data-testid="evidence-drawer">
        <span>{`${subject.kind}:${subject.id}`}</span>
        <button type="button" onClick={onClose}>
          Close evidence drawer
        </button>
      </div>
    ) : null,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

describe("ClaimsFeed", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "c1",
              policy_id: "policy-alpha-123",
              flight_id: "BA178-20260614",
              payout: 80,
              delay_minutes: 45,
              signature: "0xabcdef1234567890abcdef",
              settled_at: 1_800_000_000,
              settle_duration_ms: 118,
            },
          ]),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens claim evidence without leaving the claims route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter
          initialEntries={["/claims"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route
              path="/claims"
              element={
                <>
                  <LocationProbe />
                  <ClaimsFeed />
                </>
              }
            />
            <Route path="/flight/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("policy-alp…")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /^evidence$/i }));

    expect(screen.getByTestId("evidence-drawer")).toHaveTextContent(
      "claim:c1",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent("/claims");
  });
});
