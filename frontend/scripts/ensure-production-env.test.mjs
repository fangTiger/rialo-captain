import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const validEnv = {
  VITE_GOOGLE_CLIENT_ID: "rialo-prod.apps.googleusercontent.com",
  VITE_MAPBOX_TOKEN: "pk.rialo-production-token",
  VITE_API_BASE_URL: "https://api.rialo.example",
  VITE_WS_BASE_URL: "wss://api.rialo.example",
  VITE_DEV_LOGIN_ENABLED: "false",
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

describe("ensure-production-env", () => {
  it("passes when production Vercel env is complete", () => {
    const result = runWithEnv(validEnv);

    expect(result.status).toBe(0);
  });

  it("fails when required Vercel env is missing", () => {
    const result = runWithEnv({
      ...validEnv,
      VITE_API_BASE_URL: "",
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("VITE_API_BASE_URL 缺失");
  });

  it("fails when dev login is not disabled", () => {
    const result = runWithEnv({
      ...validEnv,
      VITE_DEV_LOGIN_ENABLED: "true",
    });

    expect(result.status).not.toBe(0);
    expect(result.output).toContain("生产环境必须关闭 VITE_DEV_LOGIN_ENABLED");
  });
});
