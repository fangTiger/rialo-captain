import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useMe } from "../hooks/useMe";

function Probe() {
  const { user, error, isLoading } = useMe();
  if (isLoading) return <div>loading</div>;
  if (error) return <div>error</div>;
  return <div>{user?.email ?? "anon"}</div>;
}

describe("useMe", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders email on success", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "u1",
          email: "a@x.com",
          name: "A",
          avatar_url: "",
          balance: 1000,
        }),
        { status: 200 },
      ),
    );

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>,
    );

    await waitFor(() =>
      expect(screen.getByText("a@x.com")).toBeInTheDocument(),
    );
  });

  it("renders 'anon' when 401", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("", { status: 401 }),
    );

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <Probe />
      </SWRConfig>,
    );

    await waitFor(() => expect(screen.getByText("anon")).toBeInTheDocument());
  });
});
