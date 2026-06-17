import { describe, expect, it, vi, afterEach } from "vitest";
import deployConfig from "../../deploy.config.json";
import { resolvePublicDeployConfig } from "../config/deployment";

describe("deployment config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses checked-in defaults for production builds", () => {
    const config = resolvePublicDeployConfig({ production: true });

    expect(config.googleClientId).toBe(deployConfig.googleClientId);
    expect(config.mapboxToken).toBe(deployConfig.mapboxToken);
    expect(config.apiBaseUrl).toBe(deployConfig.apiBaseUrl);
    expect(config.wsBaseUrl).toBe(deployConfig.wsBaseUrl);
    expect(config.devLoginEnabled).toBe(true);
  });

  it("uses same-origin Vercel API when temporary dev login is enabled", () => {
    const config = resolvePublicDeployConfig({ production: true });

    expect(config.devLoginEnabled).toBe(true);
    expect(config.apiBaseUrl).toBe("");
  });

  it("keeps local API and WS proxy behavior when no env override exists", () => {
    const config = resolvePublicDeployConfig({ production: false });

    expect(config.apiBaseUrl).toBe("");
    expect(config.wsBaseUrl).toBe("");
  });

  it("allows env overrides for preview builds", () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://preview-api.example.com");
    vi.stubEnv("VITE_WS_BASE_URL", "wss://preview-api.example.com");

    const config = resolvePublicDeployConfig({ production: true });

    expect(config.apiBaseUrl).toBe("https://preview-api.example.com");
    expect(config.wsBaseUrl).toBe("wss://preview-api.example.com");
  });
});
