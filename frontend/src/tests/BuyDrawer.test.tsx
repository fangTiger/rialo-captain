import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { BuyDrawer } from "../components/drawer/BuyDrawer";

const fakeFlight = {
  id: "BA178-20260614",
  callsign: "BA178",
  origin: "LHR",
  destination: "JFK",
  delay_rate: 0.1,
  samples: 30,
};

describe("BuyDrawer", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify(fakeFlight), { status: 200 }),
        ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders flight callsign and route", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={() => {}} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    expect(screen.getByText(/LHR/)).toBeInTheDocument();
    expect(screen.getByText(/JFK/)).toBeInTheDocument();
  });

  it("closes when the explicit close button is clicked", async () => {
    const onClose = vi.fn();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={onClose} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={onClose} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls POST /policies and reports the created policy on Confirm", async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const createdPolicy = {
      id: "p1",
      flight_id: "BA178-20260614",
      premium: 10,
      payout: 60,
      status: "active",
      contract_ref: "mock-p1",
      created_at: 1,
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/flights/")) {
        return Promise.resolve(
          new Response(JSON.stringify(fakeFlight), { status: 200 }),
        );
      }

      if (url.includes("/policies")) {
        return Promise.resolve(
          new Response(JSON.stringify(createdPolicy), { status: 201 }),
        );
      }

      if (url.includes("/me")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "u1",
              email: "x@y.com",
              name: "X",
              avatar_url: "",
              balance: 990,
            }),
            { status: 200 },
          ),
        );
      }

      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    const onPurchased = vi.fn();

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer
            flightId="BA178-20260614"
            onClose={() => {}}
            onPurchased={onPurchased}
          />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => screen.getByText("BA178"));
    fireEvent.click(screen.getByRole("button", { name: /Confirm/i }));
    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes("/policies"),
      );
      expect(call).toBeDefined();
    });
    expect(onPurchased).toHaveBeenCalledWith(createdPolicy);
  });

  it("exposes a compact desktop ticket panel via responsive shell styles", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={() => {}} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());

    expect(screen.getByTestId("buy-drawer-panel")).toHaveAttribute(
      "aria-label",
      "Buy coverage panel",
    );

    const styleText = Array.from(document.querySelectorAll("style"))
      .map((node) => node.textContent ?? "")
      .join("\n");

    expect(styleText).toContain("@media (min-width: 820px)");
    expect(styleText).toContain("width: min(26rem, calc(100vw - 40px))");
    expect(styleText).toContain("right: 20px");
  });

  it("renders a command center purchase decision panel without blocking confirm", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={() => {}} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());

    const shell = screen.getByTestId("buy-drawer-panel");
    expect(shell).toHaveClass("command-surface", "command-safe-area");

    const decisionPanel = screen.getByRole("region", {
      name: /coverage purchase decision/i,
    });
    expect(decisionPanel).toHaveClass("command-panel", "command-surface");
    expect(screen.getByLabelText("Coverage decision metrics")).toHaveAttribute(
      "role",
      "list",
    );
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("Est. payout")).toBeInTheDocument();
    expect(screen.getByText("Delay probability")).toBeInTheDocument();
    expect(screen.getByLabelText("Purchase signal boundary")).toHaveClass(
      "signal-pill",
    );
    expect(screen.getByTestId("command-panel-decor")).toHaveClass(
      "command-decorative-layer",
    );
    expect(screen.getByTestId("command-panel-decor")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByRole("button", { name: /Confirm/i })).toBeEnabled();
  });

  it("uses a readable quote metric layout in the narrow drawer", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <MemoryRouter
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          <BuyDrawer flightId="BA178-20260614" onClose={() => {}} />
        </MemoryRouter>
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("BA178")).toBeInTheDocument());

    const styleText = Array.from(document.querySelectorAll("style"))
      .map((node) => node.textContent ?? "")
      .join("\n");

    expect(styleText).toContain(
      "grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr)",
    );
    expect(styleText).toContain(
      ".buy-drawer-metrics .metric-deck__item:nth-child(3)",
    );
    expect(styleText).toContain("grid-template-areas:");
    expect(styleText).not.toContain(
      ".buy-drawer-metrics {\n            grid-template-columns: repeat(3, minmax(0, 1fr));",
    );
  });
});
