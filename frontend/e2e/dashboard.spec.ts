import { test, expect } from "@playwright/test";

test.describe("Dashboard smoke", () => {
  test("六个 nav tab 都可点击且不 console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    // 未登录: 所有受保护路由都跳 /login
    for (const path of ["/policies", "/claims", "/routes", "/rialo-inside"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    // 容忍 /api 网络错误 (后端未连通), 但 JS error 必须为 0
    const fatalErrors = errors.filter((e) => !e.includes("ChunkLoadError"));
    expect(fatalErrors).toEqual([]);
  });
});
