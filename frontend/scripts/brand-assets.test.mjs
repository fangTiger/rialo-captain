// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(scriptDir, "..");
const faviconPath = resolve(frontendDir, "public", "rialo-captain-icon.svg");

describe("brand assets", () => {
  it("points index.html at the Rialo Captain favicon asset", () => {
    const indexHtml = readFileSync(resolve(frontendDir, "index.html"), "utf8");

    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('href="/rialo-captain-icon.svg"');
    expect(indexHtml).toContain("<title>Rialo Captain</title>");
    expect(indexHtml).not.toContain("data:image/svg+xml");
  });

  it("ships a branded SVG favicon with testable metadata", () => {
    expect(existsSync(faviconPath)).toBe(true);

    const svg = readFileSync(faviconPath, "utf8");

    expect(svg).toContain('data-brand-icon="rialo-captain"');
    expect(svg).toContain("<title>Rialo Captain</title>");
    expect(svg).toMatch(/viewBox="0 0 64 64"/);
    expect(svg).toContain('data-icon-part="aircraft"');
    expect(svg).toContain('data-icon-role="primary-aircraft"');
    expect(svg.match(/data-aircraft-segment=/g) ?? []).toHaveLength(3);
    expect(svg).toContain('data-icon-role="secondary-confirmation"');
    expect(svg).toContain('data-icon-zone="lower-right"');
  });
});
