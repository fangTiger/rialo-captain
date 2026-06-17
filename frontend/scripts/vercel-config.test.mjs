import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

describe("Vercel deploy config", () => {
  it("supports deploying when Vercel root directory is frontend", () => {
    const config = readJson("vercel.json");

    expect(config.framework).toBe("vite");
    expect(config.buildCommand).toBe("node scripts/ensure-production-env.mjs && pnpm build");
    expect(config.outputDirectory).toBe("dist");
    expect(config.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });

  it("supports deploying when Vercel imports the repository root", () => {
    const config = readJson("../vercel.json");

    expect(config.framework).toBe("vite");
    expect(config.installCommand).toBe("cd frontend && pnpm install --frozen-lockfile");
    expect(config.buildCommand).toBe(
      "cd frontend && node scripts/ensure-production-env.mjs && pnpm build",
    );
    expect(config.outputDirectory).toBe("frontend/dist");
    expect(config.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });
});
