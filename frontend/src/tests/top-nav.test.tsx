import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { TopNav } from "../components/shell/TopNav";

const copilotHarness = vi.hoisted(() => ({
  openPanel: vi.fn(),
}));

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

vi.mock("../components/copilot/CopilotProvider", () => ({
  CopilotProvider: ({ children }: { children: ReactNode }) => children,
  useCopilot: () => copilotHarness,
}));

vi.mock("../hooks/useWebSocket", () => ({
  useWebSocket: () => {},
}));

vi.mock("../components/search/SearchHotkey", () => ({
  SearchHotkey: () => null,
}));

vi.mock("../components/shell/ToastRenderer", () => ({
  ToastRenderer: () => null,
}));

vi.mock("../components/shell/StatusBar", () => ({
  StatusBar: () => null,
}));

vi.mock("../routes/Login", () => ({
  Login: () => <div>login page</div>,
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

  it("does not show a global Ask Rialo launcher on protected navigation", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: /ask rialo/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("PRESS /")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
    expect(screen.getByText("captain@rialo.test")).toBeInTheDocument();
    expect(copilotHarness.openPanel).not.toHaveBeenCalled();
  });

  it("pins the top nav to a stable height token", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TopNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation")).toHaveStyle({
      minHeight: "var(--top-nav-height, 64px)",
    });
  });

  it("does not show Ask Rialo on /login", () => {
    window.history.pushState({}, "", "/login");

    render(<App />);

    expect(screen.getByText("login page")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /ask rialo/i }),
    ).not.toBeInTheDocument();
  });
});
