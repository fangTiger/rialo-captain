import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteRow } from "../components/routes/RouteRow";
import type { HotRoute } from "../hooks/useHotRoutes";

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
});
