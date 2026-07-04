import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokensCss = readFileSync(resolve(process.cwd(), "src/design/tokens.css"), "utf8");
const mainTsx = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");

function aiBriefingScrollbarRules() {
  return Array.from(
    tokensCss.matchAll(/\.ai-briefing-answer-scroll[^{]*\{[^}]*\}/g),
    (match) => match[0],
  ).join("\n");
}

function cssRule(selector: string) {
  return cssRuleFrom(tokensCss, selector);
}

function cssRuleFrom(css: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{[^}]*\\}`, "s"));
  return match?.[0] ?? "";
}

function mediaBlock(startMarker: string, endMarker: string) {
  const start = tokensCss.indexOf(startMarker);
  const end = tokensCss.indexOf(endMarker, start + startMarker.length);

  if (start === -1 || end === -1) {
    return "";
  }

  return tokensCss.slice(start, end);
}

function cssRulesForSelector(selector: string) {
  return Array.from(tokensCss.matchAll(/(?:^|\n)([^{}]+)\{[^}]*\}/g), (match) => match[0])
    .filter((rule) => {
      const selectorList = rule.slice(0, rule.indexOf("{"));
      return selectorList
        .split(",")
        .map((entry) => entry.trim())
        .includes(selector);
    })
    .join("\n");
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

  it("loads Command Center tokens from the application entry", () => {
    expect(mainTsx).toContain('import "./design/tokens.css"');
    expect(tokensCss).toContain("--command-bg");
    expect(tokensCss).toContain("--command-surface-panel");
    expect(tokensCss).toContain("--command-surface-glass");
    expect(tokensCss).toContain("--accent-radar");
    expect(tokensCss).toContain("--accent-weather");
    expect(tokensCss).toContain("--risk-low");
    expect(tokensCss).toContain("--risk-guarded");
    expect(tokensCss).toContain("--risk-elevated");
    expect(tokensCss).toContain("--risk-severe");
    expect(tokensCss).toContain("--glow-command");
    expect(tokensCss).toContain("--glow-severe");
    expect(tokensCss).toContain("--motion-duration-scan");
    expect(tokensCss).toContain("--motion-ease-radar");
    expect(tokensCss).toContain("--font-size-hud");
    expect(tokensCss).toContain("--layout-safe-inline");
  });

  it("defines reusable Command Center utility classes", () => {
    expect(cssRule(".command-center-shell")).toContain("background");
    expect(cssRule(".command-surface")).toContain("var(--command-surface-panel)");
    expect(cssRule(".command-panel")).toContain("border");
    expect(cssRule(".metric-deck")).toContain("grid-template-columns");
    expect(cssRule(".signal-pill")).toContain("border-radius: var(--radius-pill)");
    expect(cssRule(".divergence-meter")).toContain("--divergence-track");
    expect(cssRule(".risk-ticker")).toContain("overflow: hidden");
    expect(cssRule(".command-scanline")).toContain("command-scanline-drift");
    expect(cssRule(".risk-level--severe")).toContain("var(--risk-severe)");
  });

  it("keeps decorative Command Center layers from intercepting pointer events", () => {
    const decorativeRule = cssRule(".command-decorative-layer");
    const scanlineRule = cssRule(".command-scanline");

    expect(decorativeRule).toContain("pointer-events: none");
    expect(scanlineRule).toContain("pointer-events: none");
    expect(cssRule(".command-hit-target")).toContain("pointer-events: auto");
  });

  it("provides global focus, safe-area and reduced-motion constraints", () => {
    expect(cssRule(".command-focus-ring:focus-visible")).toContain("outline");
    expect(cssRule(".command-safe-area")).toContain("env(safe-area-inset-bottom)");
    expect(tokensCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokensCss).toContain(".radar-sweep");
    expect(tokensCss).toContain(".risk-ticker__track");
    expect(tokensCss).toMatch(/animation(?:-duration)?:\s*(?:none|1ms)/);
  });

  it("constrains RiskTicker long text for narrow mobile containers", () => {
    const tickerItemRule = cssRule(".risk-ticker__item");

    expect(tickerItemRule).toContain("grid-template-columns: minmax(0, 1fr) auto auto");
    expect(tickerItemRule).toContain("min-width: 0");
    expect(tickerItemRule).toContain("max-width: 100%");
    expect(tickerItemRule).toContain("overflow-wrap: anywhere");

    for (const selector of [
      ".risk-ticker__label",
      ".risk-ticker__value",
      ".risk-ticker__direction",
      ".risk-ticker__detail",
    ]) {
      const textRule = cssRulesForSelector(selector);

      expect(textRule).toContain("min-width: 0");
      expect(textRule).toContain("overflow-wrap: anywhere");
    }
  });

  it("stops RiskTicker animation in small-screen wrap mode", () => {
    const mobileBlock = mediaBlock(
      "@media (max-width: 480px)",
      "@media (prefers-reduced-motion: reduce)",
    );
    const mobileTickerTrackRule = cssRuleFrom(mobileBlock, ".risk-ticker__track");

    expect(mobileTickerTrackRule).toContain("flex-wrap: wrap");
    expect(mobileTickerTrackRule).toContain("animation: none");
    expect(mobileTickerTrackRule).toContain("transform: none");
    expect(mobileTickerTrackRule).not.toContain("animation-duration: 1ms");
  });
});
