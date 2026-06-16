import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TopNav } from "../components/shell/TopNav";

vi.mock("../hooks/useMe", () => ({
  useMe: () => ({
    user: {
      id: "u1",
      email: "captain@rialo.test",
      name: "Captain",
      avatar_url: "",
      balance: 990,
    },
  }),
}));

describe("TopNav", () => {
  it("shows the global search hint before balance label", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TopNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation");
    expect(screen.getByText("PRESS /")).toBeInTheDocument();
    expect(nav.textContent).toMatch(/PRESS \/BAL/);
  });
});
