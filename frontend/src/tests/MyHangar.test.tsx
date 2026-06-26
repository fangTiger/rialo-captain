import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { MyHangar } from "../routes/MyHangar";
import { useEventStore } from "../store/eventStore";

const copilotHarness = vi.hoisted(() => ({
  ask: vi.fn(),
  openPanel: vi.fn(),
}));

vi.mock("../components/evidence/EvidenceDrawer", () => ({
  EvidenceDrawer: ({
    subject,
    onClose,
  }: {
    subject: EvidenceSubject;
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

vi.mock("../components/copilot/CopilotProvider", () => ({
  useCopilot: () => copilotHarness,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

describe("MyHangar", () => {
  beforeEach(() => {
    useEventStore.setState({ flares: [], toasts: [], wsState: "idle" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: "p1",
              flight_id: "BA178-20260614",
              premium: 10,
              payout: 80,
              status: "active",
              contract_ref: "mock-policy-one",
              created_at: 1,
            },
            {
              id: "p2",
              flight_id: "DL101-20260614",
              premium: 5,
              payout: 30,
              status: "paid",
              contract_ref: "mock-policy-two",
              created_at: 2,
            },
            {
              id: "p3",
              flight_id: "UA200-20260614",
              premium: 20,
              payout: 120,
              status: "expired",
              contract_ref: "mock-policy-three",
              created_at: 3,
            },
          ]),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    copilotHarness.ask.mockReset();
    copilotHarness.openPanel.mockReset();
  });

  it("groups policies into active, paid, and expired hangar lanes", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <MyHangar />
        </SWRConfig>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/PAID/)).toBeInTheDocument();
    expect(screen.getByText(/EXPIRED/)).toBeInTheDocument();
    expect(screen.getByText("DL101-20260614")).toBeInTheDocument();
    expect(screen.getByText("UA200-20260614")).toBeInTheDocument();
    expect(screen.getByText("10 RIA")).toBeInTheDocument();
    expect(screen.getByText("120 RIA")).toBeInTheDocument();
  });

  it("opens policy evidence without changing the current route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter
          initialEntries={["/policies"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route
              path="/policies"
              element={
                <>
                  <LocationProbe />
                  <MyHangar />
                </>
              }
            />
            <Route path="/flight/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /view evidence for policy p1/i }),
    );

    expect(screen.getByTestId("evidence-drawer")).toHaveTextContent(
      "policy:p1",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent("/policies");
  });

  it("asks Rialo about a policy without opening the flight route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MemoryRouter
          initialEntries={["/policies"]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <Routes>
            <Route
              path="/policies"
              element={
                <>
                  <LocationProbe />
                  <MyHangar />
                </>
              }
            />
            <Route path="/flight/:id" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("BA178-20260614")).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: "Explain this policy" })[0],
    );

    expect(copilotHarness.ask).toHaveBeenCalledWith({
      question: "Explain this policy",
      subjectType: "policy",
      subjectId: "p1",
    });
    expect(screen.getByTestId("location-path")).toHaveTextContent("/policies");
  });
});
