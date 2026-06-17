import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const validConfig = {
  googleClientId: "rialo-prod.apps.googleusercontent.com",
  mapboxToken: "pk.rialo-production-token",
  apiBaseUrl: "https://api.rialo.example",
  wsBaseUrl: "wss://api.rialo.example",
  devLoginEnabled: false,
};

const validDevLoginConfig = {
  ...validConfig,
  googleClientId: "",
  apiBaseUrl: "",
  wsBaseUrl: "",
  devLoginEnabled: true,
};

function runWithEnv(env) {
  try {
    const stdout = execFileSync(process.execPath, ["scripts/ensure-production-env.mjs"], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH, ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, output: stdout };
  } catch (error) {
    const result = error;
    return {
      status: result.status ?? 1,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    };
  }
}

function writeConfig(config) {
  const dir = mkdtempSync(join(tmpdir(), "rialo-deploy-config-"));
  const path = join(dir, "deploy.config.json");
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return path;
}

describe("ensure-production-env", () => {
  it("passes using checked-in deploy config without Vercel env", () => {
    const result = runWithEnv({});

    expect(result.status).toBe(0);
  });

  it("fails when checked-in API config is missing", () => {
    const result = runWithEnv({
      RIALO_DEPLOY_CONFIG_PATH: writeConfig({
        ...validConfig,
        apiBaseUrl: "",
      }),
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("apiBaseUrl 缺失");
  });

  it("passes when temporary dev login uses same-origin API without Google OAuth", () => {
    const result = runWithEnv({
      RIALO_DEPLOY_CONFIG_PATH: writeConfig(validDevLoginConfig),
    });

    expect(result.status).toBe(0);
  });

  it("allows preview env to override checked-in API config", () => {
    const result = runWithEnv({
      RIALO_DEPLOY_CONFIG_PATH: writeConfig(validConfig),
      VITE_API_BASE_URL: "https://preview-api.example.com",
    });

    expect(result.status).toBe(0);
  });
});
