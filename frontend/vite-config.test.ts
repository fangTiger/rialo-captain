// @vitest-environment node

import type { ProxyOptions, UserConfig } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

function proxyTarget(config: UserConfig, path: "/api" | "/ws") {
  const proxy = config.server?.proxy;
  if (!proxy || Array.isArray(proxy)) return undefined;

  const entry = proxy[path];
  if (typeof entry === "string") return entry;

  return (entry as ProxyOptions | undefined)?.target;
}

describe("vite dev proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("can point the same-origin dev proxy at a non-default backend port", async () => {
    vi.stubEnv("VITE_DEV_BACKEND_ORIGIN", "http://127.0.0.1:8001");
    vi.resetModules();

    const { default: config } = await import("./vite.config");

    expect(proxyTarget(config as UserConfig, "/api")).toBe("http://127.0.0.1:8001");
    expect(proxyTarget(config as UserConfig, "/ws")).toBe("ws://127.0.0.1:8001");
  });
});
