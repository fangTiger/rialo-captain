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
});
