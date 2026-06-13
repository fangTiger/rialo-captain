import { test, expect } from "@playwright/test";

test("未登录用户被引导到 /login 并看到 sign-in 按钮", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /Google/i })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/The tower/i)).toBeVisible();
});
