import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HangarSlot } from "../components/hangar/HangarSlot";
import type { Policy } from "../hooks/usePolicies";

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

const policy: Policy = {
  id: "p1",
  flight_id: "BA178-20260614",
  premium: 10,
  payout: 80,
  status: "active",
  contract_ref: "mock-policy-one",
  created_at: 1,
};

function renderHangarSlot() {
  render(
    <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <HangarSlot p={policy} />
    </MemoryRouter>,
  );
  return screen.getByRole("button", { name: /BA178-20260614/i });
}

describe("HangarSlot", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("navigates to the policy flight with hangar breadcrumb state when clicked", () => {
    const slot = renderHangarSlot();

    fireEvent.click(slot);

    expect(navigateMock).toHaveBeenCalledWith("/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
  });

  it("uses the same navigation for Enter and Space", () => {
    const slot = renderHangarSlot();

    fireEvent.keyDown(slot, { key: "Enter" });
    fireEvent.keyDown(slot, { key: " " });

    expect(navigateMock).toHaveBeenNthCalledWith(1, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
    expect(navigateMock).toHaveBeenNthCalledWith(2, "/flight/BA178-20260614", {
      state: { from: "/policies" },
    });
  });
});
