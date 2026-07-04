import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { TopNav } from "../components/shell/TopNav";
import { useEventStore } from "../store/eventStore";

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
  it("renders the Rialo Captain brand lockup as the home link", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TopNav />
      </MemoryRouter>,
    );

    const brandLink = screen.getByRole("link", {
      name: "Rialo Captain home",
    });

    expect(screen.getByRole("navigation")).toHaveClass(
      "top-nav",
      "command-surface",
    );
    expect(brandLink).toHaveClass("top-nav__brand", "command-focus-ring");
    expect(brandLink).toHaveAttribute("href", "/");
    expect(screen.getByTestId("rialo-brand-lockup")).toBeInTheDocument();
    const brandMark = screen.getByTestId("rialo-brand-mark");
    expect(brandMark).toBeInTheDocument();
    expect(
      brandMark.querySelector('[data-icon-part="aircraft"]'),
    ).toBeInTheDocument();
    expect(
      brandMark.querySelector('[data-icon-role="primary-aircraft"]'),
    ).toBeInTheDocument();
    expect(
      brandMark.querySelectorAll("[data-aircraft-segment]").length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      brandMark.querySelector('[data-icon-role="secondary-confirmation"]'),
    ).toHaveAttribute("data-icon-zone", "lower-right");
    expect(screen.getByText("Rialo Captain")).toBeInTheDocument();
    expect(screen.queryByText("RIALO ◦ CAPTAIN")).not.toBeInTheDocument();
  });

  it("renders the status bar as Command Center telemetry", async () => {
    const { StatusBar } = await vi.importActual<
      typeof import("../components/shell/StatusBar")
    >("../components/shell/StatusBar");

    useEventStore.setState({
      flares: [
        {
          flight_id: "UAL2351",
          policy_id: "p1",
          payout: 120,
          delay_minutes: 45,
          signature: "0xabc",
          settle_duration_ms: 900,
        },
      ],
      toasts: [],
      events: [],
      wsState: "open",
    });

    render(<StatusBar />);

    const statusBar = screen.getByRole("contentinfo");
    expect(statusBar).toHaveClass(
      "status-bar",
      "command-surface",
      "command-safe-area",
    );
    expect(statusBar.querySelector(".status-bar__signal")).toHaveAttribute(
      "data-state",
      "open",
    );
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText(/FLARES/)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

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

  it("groups navigation and status for narrow screens without horizontal-scroll fallback", () => {
    render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <TopNav />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation");

    expect(nav).toHaveClass("top-nav--responsive");
    expect(nav).toHaveStyle({
      flexWrap: "wrap",
      overflowX: "visible",
    });
    expect(nav.querySelector(".top-nav__primary")).toBeInTheDocument();
    expect(nav.querySelector(".top-nav__tabs")).toBeInTheDocument();
    expect(nav.querySelector(".top-nav__status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rialo Captain home" })).toBeInTheDocument();
    expect(screen.getByText("PRESS /")).toBeInTheDocument();
    expect(screen.getByText("990 RIA")).toBeInTheDocument();
    expect(screen.getByText("captain@rialo.test")).toBeInTheDocument();
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
