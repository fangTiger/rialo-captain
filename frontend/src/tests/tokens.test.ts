import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(resolve(process.cwd(), "src/design/tokens.css"), "utf8");

function aiBriefingScrollbarRules() {
  return Array.from(
    tokensCss.matchAll(/\.ai-briefing-answer-scroll[^{]*\{[^}]*\}/g),
    (match) => match[0],
  ).join("\n");
}

describe("design tokens", () => {
  it("motion constants are stable", async () => {
    const m = await import("../design/motion");

    expect(m.DURATION.fast).toBe(160);
    expect(m.DURATION.mid).toBe(280);
    expect(m.DURATION.slow).toBe(600);
    expect(m.EASE_OUT).toMatch(/cubic-bezier/);
  });

  it("defines dark AI Briefing scrollbar rules in tokens.css", () => {
    const scrollbarRules = aiBriefingScrollbarRules();

    expect(tokensCss).toContain(".ai-briefing-answer-scroll");
    expect(scrollbarRules).toContain("scrollbar-gutter: stable");
    expect(scrollbarRules).toContain("scrollbar-width: thin");
    expect(scrollbarRules).toContain("scrollbar-color");
    expect(tokensCss).toContain(".ai-briefing-answer-scroll::-webkit-scrollbar-thumb");
    expect(tokensCss).toContain(".ai-briefing-answer-scroll::-webkit-scrollbar-track");
    expect(scrollbarRules).not.toMatch(/\bwhite\b|#fff(?:fff)?\b/i);
  });
});
