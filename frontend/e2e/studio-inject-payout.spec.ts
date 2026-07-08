import { expect, test, type Page } from "@playwright/test";

const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === "1";

interface LiveFlight {
  callsign: string;
  longitude: number | null;
  latitude: number | null;
  on_ground: boolean;
}

interface LiveResponse {
  flights: LiveFlight[];
}

async function devLogin(page: Page, email: string) {
  const response = await page.request.post("/api/auth/dev-login", {
    data: { email, name: "Studio Captain" },
  });
  expect(response.ok()).toBeTruthy();
}

async function waitForLiveFlight(page: Page) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/flights/live");
        if (!response.ok()) return 0;
        const body = (await response.json()) as LiveResponse;
        return body.flights.filter(
          (flight) =>
            flight.callsign.trim() &&
            flight.longitude !== null &&
            flight.latitude !== null &&
            !flight.on_ground,
        ).length;
      },
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
}

async function openSteadyPool(page: Page) {
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "Underwrite delay risk in 3 seconds." }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /OPEN POOL/ }).click();
  await expect(page.getByRole("heading", { name: "Underwriter pool live" })).toBeVisible({
    timeout: 15000,
  });
}

async function paidOutRia(page: Page) {
  const text = await page.locator('[aria-label="Pool KPI band"]').textContent();
  const match = text?.match(/PAID OUT\s*(\d+) RIA/);
  return match ? Number(match[1]) : 0;
}

test.describe("Underwriter Studio inject payout", () => {
  test.skip(
    !useLocalServer,
    "本地沙箱不可绑定前后端端口；设置 PLAYWRIGHT_USE_LOCAL_SERVER=1 后运行真实 Studio e2e",
  );

  test("injects a bound delay and shows Tower FLARE plus Studio paid-out KPI", async ({
    context,
    page: studioPage,
  }) => {
    test.setTimeout(70000);

    const towerPage = await context.newPage();
    await devLogin(studioPage, `studio-payout-${Date.now()}@local.dev`);
    await waitForLiveFlight(studioPage);

    await towerPage.goto("/");
    await expect(towerPage.getByTestId(/flight-dot-/).first()).toBeVisible({
      timeout: 15000,
    });

    await openSteadyPool(studioPage);
    await expect(towerPage.locator('[data-underwritten="true"]').first()).toBeVisible({
      timeout: 25000,
    });

    const beforePaidOut = await paidOutRia(studioPage);
    await studioPage.getByRole("button", { name: "Inject demo delay" }).click();

    await expect.poll(async () => paidOutRia(studioPage), { timeout: 10000 }).toBeGreaterThan(
      beforePaidOut,
    );
    await expect(studioPage.getByRole("list", { name: "Pool event ticker" })).toContainText(
      /Paid out/,
    );
    await expect(towerPage.getByTestId(/underwriter-flare-/).first()).toBeVisible({
      timeout: 3000,
    });
  });
});
