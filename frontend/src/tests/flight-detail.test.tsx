import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidenceSubject } from "../hooks/useEvidenceTimeline";
import { FlightDetail } from "../routes/FlightDetail";

vi.mock("../routes/TowerShell", () => ({
  TowerShell: () => <div data-testid="tower-shell">tower shell</div>,
}));

vi.mock("../components/drawer/BuyDrawer", () => ({
  BuyDrawer: () => <div data-testid="buy-drawer">buy drawer</div>,
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

const flight = {
  id: "BA178-20260614",
  callsign: "BA178",
  origin: "LHR",
  destination: "JFK",
  delay_rate: 0.25,
  samples: 147,
  live_delay_minutes: 12,
};

const paidPolicy = {
  id: "paid-policy",
  flight_id: "BA178-20260614",
  premium: 10,
  payout: 49,
  status: "paid",
  contract_ref: "mock-paid-policy",
  created_at: 1,
};

const activePolicy = {
  ...paidPolicy,
  id: "active-policy",
  status: "active",
  contract_ref: "mock-active-policy",
};

const claim = {
  id: "claim-one",
  policy_id: "paid-policy",
  flight_id: "BA178-20260614",
  payout: 80,
  delay_minutes: 45,
  signature: "0xabcdef1234567890abcdef",
  settled_at: 1_800_000_000,
  settle_duration_ms: 118,
};

function stubApi({
  flightStatus = 200,
  policies = [paidPolicy],
  claims = [claim],
}: {
  flightStatus?: number;
  policies?: unknown[];
  claims?: unknown[];
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/flights/")) {
        return Promise.resolve(
          new Response(
            flightStatus === 200 ? JSON.stringify(flight) : "not found",
            { status: flightStatus },
          ),
        );
      }

      if (url.includes("/api/policies")) {
        return Promise.resolve(
          new Response(JSON.stringify(policies), { status: 200 }),
        );
      }

      if (url.includes("/api/claims/recent?flight_id=")) {
        return Promise.resolve(
          new Response(JSON.stringify(claims), { status: 200 }),
        );
      }

      if (url.includes("/api/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "u1",
              email: "captain@rialo.test",
              name: "Captain",
              avatar_url: "",
              balance: 990,
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response("{}", { status: 200 }));
    }),
  );
}

function renderFlightDetail(
  id = "BA178-20260614",
  state: Record<string, unknown> | null = { from: "/claims" },
) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter
        initialEntries={[{ pathname: `/flight/${id}`, state }]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/flight/:id" element={<FlightDetail />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
}

function renderFlightDetailWithLocation(
  id = "BA178-20260614",
  state: Record<string, unknown> | null = { from: "/claims" },
) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter
        initialEntries={[{ pathname: `/flight/${id}`, state }]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route
            path="/flight/:id"
            element={
              <>
                <LocationProbe />
                <FlightDetail />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe("FlightDetail", () => {
  beforeEach(() => {
    stubApi({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the static flight detail blocks without TowerShell", async () => {
    renderFlightDetail();

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    expect(screen.queryByTestId("tower-shell")).not.toBeInTheDocument();
    expect(screen.getByText("← CLAIMS FEED")).toBeInTheDocument();
    expect(screen.getByText("LHR")).toBeInTheDocument();
    expect(screen.getByText("JFK")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("147")).toBeInTheDocument();
    expect(screen.getByText("4.9×")).toBeInTheDocument();
    expect(screen.getByText("+12 min")).toBeInTheDocument();
    expect(screen.getByText("INSURE")).toBeInTheDocument();
    expect(screen.getByText("YOUR POLICIES ON THIS FLIGHT")).toBeInTheDocument();
    expect(screen.getByText("CLAIM HISTORY")).toBeInTheDocument();
    expect(screen.getByText("BA178-20260614")).toBeInTheDocument();
    expect(screen.getByText("+80 RIA")).toBeInTheDocument();
  });

  it("replaces the insure block when an active policy exists", async () => {
    stubApi({ policies: [activePolicy] });

    renderFlightDetail();

    await waitFor(() =>
      expect(
        screen.getByText("You hold 1 active policy on this flight · view in HANGAR →"),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("keeps related sections visible when the flight is 404", async () => {
    stubApi({ flightStatus: 404, policies: [], claims: [] });

    renderFlightDetail("UNKNOWN-20260614", null);

    await waitFor(() =>
      expect(
        screen.getByText("Flight no longer tracked · ID: UNKNOWN-20260614"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("UNKNOWN-20260614")).toBeInTheDocument();
    expect(screen.getByText("← TOWER")).toBeInTheDocument();
    expect(screen.getByText("YOUR POLICIES ON THIS FLIGHT")).toBeInTheDocument();
    expect(screen.getByText("CLAIM HISTORY")).toBeInTheDocument();
  });

  it("renders empty states for policies and claims", async () => {
    stubApi({ policies: [], claims: [] });

    renderFlightDetail();

    await waitFor(() =>
      expect(screen.getByText("No policies on this flight")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("No claim yet · auto-settled when delayed ≥ 30 min"),
    ).toBeInTheDocument();
  });

  it("opens related policy and claim evidence without leaving the flight detail route", async () => {
    renderFlightDetailWithLocation();

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());

    const policiesSection = screen
      .getByRole("heading", { name: "YOUR POLICIES ON THIS FLIGHT" })
      .closest("section");
    const claimsSection = screen
      .getByRole("heading", { name: "CLAIM HISTORY" })
      .closest("section");

    if (!policiesSection || !claimsSection) {
      throw new Error("Expected related sections to render");
    }

    fireEvent.click(
      within(policiesSection).getByRole("button", {
        name: /view evidence for policy paid-policy/i,
      }),
    );

    expect(screen.getByTestId("evidence-drawer")).toHaveTextContent(
      "policy:paid-policy",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/flight/BA178-20260614",
    );

    fireEvent.click(
      within(claimsSection).getByRole("button", {
        name: /view evidence for claim claim-one/i,
      }),
    );

    expect(screen.getByTestId("evidence-drawer")).toHaveTextContent(
      "claim:claim-one",
    );
    expect(screen.getByTestId("location-path")).toHaveTextContent(
      "/flight/BA178-20260614",
    );
  });
});
