import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SWRConfig } from "swr";
import { Login } from "../routes/Login";

function renderLogin() {
  render(
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

  it("shows dev login only when enabled and posts credentials", async () => {
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

    expect(screen.getByText("DEV ONLY · BYPASS GOOGLE OAUTH")).toBeInTheDocument();
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
});
