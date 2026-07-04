import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRow } from "../components/routes/RouteRow";
import type { HotRoute } from "../hooks/useHotRoutes";
import { HotRoutes } from "../routes/HotRoutes";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const route: HotRoute = {
  callsign: "BA178",
  flight_id: "BA178-20260614-real",
  policy_count: 5,
  delay_rate: 0.6,
  samples: 5,
};

function renderRouteRow() {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <RouteRow r={route} rank={1} />
    </MemoryRouter>,
  );
  return screen.getByRole("button", { name: /BA178/i });
}

describe("RouteRow", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates with the backend flight id and routes breadcrumb state", () => {
    const row = renderRouteRow();

    fireEvent.click(row);

    expect(navigateMock).toHaveBeenCalledWith("/flight/BA178-20260614-real", {
      state: { from: "/routes" },
    });
  });

  it("uses the same navigation for Enter and Space", () => {
    const row = renderRouteRow();

    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyDown(row, { key: " " });

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/flight/BA178-20260614-real", {
      state: { from: "/routes" },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/flight/BA178-20260614-real", {
      state: { from: "/routes" },
    });
  });

  it("uses a wrapping grid instead of fixed columns for narrow route boards", () => {
    const row = renderRouteRow();
    const style = row.getAttribute("style") ?? "";

    expect(style).toContain("repeat(auto-fit");
    expect(style).toContain("minmax(min(");
    expect(row).toHaveStyle({ overflowWrap: "anywhere" });
  });
});

describe("HotRoutes", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([route]), { status: 200 }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders hot routes as a command center risk board", async () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <HotRoutes />
        </SWRConfig>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", {
        name: /open flight BA178-20260614-real for route BA178/i,
      }),
    ).toBeInTheDocument();

    const commandPanel = screen.getByRole("region", {
      name: /hot routes command center/i,
    });

    expect(commandPanel).toHaveClass("command-panel");
    expect(screen.getByText("DEMAND HEAT")).toBeInTheDocument();
    expect(screen.getByText("WEATHER / MARKET WATCH")).toBeInTheDocument();
    expect(screen.getByText("LIVE ROUTE SIGNALS")).toBeInTheDocument();
    expect(screen.getByText("signal-only")).toBeInTheDocument();
  });
});
