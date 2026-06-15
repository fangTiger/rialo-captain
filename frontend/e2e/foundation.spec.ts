import { test, expect } from "@playwright/test";

const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === "1";

test.skip(
  !useLocalServer,
  "本地沙箱不可启动完整前后端与 Chromium 会话；设置 PLAYWRIGHT_USE_LOCAL_SERVER=1 后运行真实 foundation smoke",
);

test("未登录用户被引导到 /login 并看到 sign-in 按钮", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /Google/i })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/The tower/i)).toBeVisible();
});
