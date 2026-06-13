import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "../api/client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /api prefix and includes credentials", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const result = await apiFetch<{ ok: boolean }>("/me");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("throws ApiError on non-2xx", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("nope", { status: 401 }),
    );

    await expect(apiFetch("/me")).rejects.toBeInstanceOf(ApiError);
  });
});
