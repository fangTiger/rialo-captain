import { describe, expect, it } from "vitest";

describe("design tokens", () => {
  it("motion constants are stable", async () => {
    const m = await import("../design/motion");

    expect(m.DURATION.fast).toBe(160);
    expect(m.DURATION.mid).toBe(280);
    expect(m.DURATION.slow).toBe(600);
    expect(m.EASE_OUT).toMatch(/cubic-bezier/);
  });
});
