import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { SWRConfig } from "swr";
import { ProtectedRoute } from "../auth/ProtectedRoute";

function Wrap({ initial = "/" }: { initial?: string }) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter
        initialEntries={[initial]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>secret</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </SWRConfig>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children when /me returns user", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "u",
          email: "a@x.com",
          name: "A",
          avatar_url: "",
          balance: 1000,
        }),
        { status: 200 },
      ),
    );

    render(<Wrap />);

    await waitFor(() =>
      expect(screen.getByText("secret")).toBeInTheDocument(),
    );
  });

  it("redirects to /login when /me returns 401", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response("", { status: 401 }),
    );

    render(<Wrap />);

    await waitFor(() =>
      expect(screen.getByText("login page")).toBeInTheDocument(),
    );
  });
});
