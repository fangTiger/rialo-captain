import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SWRConfig } from "swr";
import { Login } from "../routes/Login";

function renderLogin() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemoryRouter
        initialEntries={["/login"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/" element={<div>Tower shell</div>} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </SWRConfig>,
  );
}

describe("Login", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders the Tower landing shell with semantic motion layers", () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );

    const { container } = renderLogin();
    const page = container.querySelector(".login-page");
    const shell = container.querySelector(".login-shell");

    expect(page).toHaveClass("command-center-shell", "login-command-center");
    expect(shell).not.toBeNull();
    expect(screen.getByRole("button", { name: "Latch APP" })).toHaveClass(
      "command-focus-ring",
    );
    expect(container.querySelector(".login-access-panel")).toHaveClass(
      "command-surface",
    );
    expect(container.querySelector(".login-signal-panel")).toHaveClass(
      "command-surface",
    );

    expect(screen.getByTestId("login-radar-field")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("login-flight-trails")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.getByTestId("login-pulse-layer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(
      screen.getByRole("heading", { name: /latch tower/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/live tower access for flight cover and claims/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("rialo-logo-mark")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Rialo Captain")).not.toBeInTheDocument();
    expect(screen.queryByText("RIALO · CAPTAIN")).not.toBeInTheDocument();
    expect(container.querySelector(".login-brand")).toBeNull();
    expect(screen.getByText("Live field")).toBeInTheDocument();
    expect(screen.getByText("Ready latch")).toBeInTheDocument();
    expect(screen.getByText("Warm relay")).toBeInTheDocument();
    expect(
      screen.getByText("Latch demo clearance into the active flight field."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Login with Latch" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sweep live")).toBeInTheDocument();
    expect(screen.getByText("Bind ready")).toBeInTheDocument();
    expect(screen.getByText("Claims warm")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Login page sections" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Latch APP" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByRole("dialog", { name: "DEV access" }),
    ).not.toBeInTheDocument();
    expect(shell).not.toHaveAttribute("aria-hidden");
    expect(shell).not.toHaveAttribute("inert");
  });

  it("closes the dev dialog and restores focus to the launcher", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );

    const { container } = renderLogin();
    const shell = container.querySelector(".login-shell");

    expect(shell).not.toBeNull();

    const launcher = screen.getByRole("button", { name: "Latch APP" });
    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "DEV access" });
    const emailInput = screen.getByLabelText("Dev login email");

    expect(dialog).toHaveClass("command-panel", "command-surface");
    expect(emailInput).toHaveClass("command-focus-ring");
    expect(screen.getByRole("button", { name: "Dev Login" })).toHaveClass(
      "command-focus-ring",
    );
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(emailInput).toHaveFocus());
    await waitFor(() => expect(shell).toHaveAttribute("aria-hidden", "true"));
    expect(shell).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "Close DEV access" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "DEV access" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(shell).not.toHaveAttribute("aria-hidden"));
    expect(shell).not.toHaveAttribute("inert");
    await waitFor(() => expect(launcher).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it("hides dev login controls when dev login is disabled", () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "false");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );

    renderLogin();

    expect(
      screen.queryByRole("button", { name: "Latch APP" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "DEV access" }),
    ).not.toBeInTheDocument();
  });

  it("closes the dev dialog on Escape and restores shell access", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );

    const { container } = renderLogin();
    const shell = container.querySelector(".login-shell");

    expect(shell).not.toBeNull();

    const launcher = screen.getByRole("button", { name: "Latch APP" });
    fireEvent.click(launcher);

    const dialog = screen.getByRole("dialog", { name: "DEV access" });
    const closeButton = screen.getByRole("button", { name: "Close DEV access" });
    const submitButton = screen.getByRole("button", { name: "Dev Login" });

    await waitFor(() => expect(shell).toHaveAttribute("aria-hidden", "true"));
    expect(shell).toHaveAttribute("inert");

    submitButton.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "DEV access" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(shell).not.toHaveAttribute("aria-hidden"));
    expect(shell).not.toHaveAttribute("inert");
    await waitFor(() => expect(launcher).toHaveAttribute("aria-expanded", "false"));
    await waitFor(() => expect(launcher).toHaveFocus());
  });

  it("opens dev login from the Latch APP entry and posts credentials", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/auth/dev-login")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "dev-user",
                email: "pilot@local.dev",
                name: "Dev Captain",
                avatar_url: "",
                balance: 1000,
              }),
              { status: 200 },
            ),
          );
        }

        return Promise.resolve(new Response("", { status: 401 }));
      }),
    );

    renderLogin();

    const launcher = screen.getByRole("button", { name: "Latch APP" });
    expect(launcher).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Dev login email")).not.toBeInTheDocument();

    fireEvent.click(launcher);

    expect(launcher).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "DEV access" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    await waitFor(() => expect(screen.getByLabelText("Dev login email")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Dev login email"), {
      target: { value: "pilot@local.dev" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dev Login" }));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/auth/dev-login",
        expect.objectContaining({
          body: JSON.stringify({
            email: "pilot@local.dev",
            name: "Dev Captain",
          }),
          method: "POST",
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText("Tower shell")).toBeInTheDocument());
  });

  it("opens dev login from the main Latch login action", async () => {
    vi.stubEnv("VITE_DEV_LOGIN_ENABLED", "true");
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 401 }))),
    );

    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Login with Latch" }));

    expect(screen.getByRole("dialog", { name: "DEV access" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Dev login email")).toHaveFocus());
  });
});
