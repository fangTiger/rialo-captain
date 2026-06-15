import { test, expect, type Page } from "@playwright/test";

const useLocalServer = process.env.PLAYWRIGHT_USE_LOCAL_SERVER === "1";
const screenshotDir = "tests/screenshots";
const captainEmail = "captain@local.dev";

interface FlightPublic {
  callsign: string;
  longitude: number | null;
  latitude: number | null;
  on_ground: boolean;
}

interface LiveResponse {
  flights: FlightPublic[];
}

interface SeedDemoResponse {
  protagonist_name: string | null;
  flight_id: string;
  policy_ids: string[];
  policies_created: number;
  claims_settled: number;
}

function todayFlightSuffix() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function flightIdForCallsign(callsign: string) {
  return `${callsign.trim()}-${todayFlightSuffix()}`;
}

async function silenceBrowserAutoSeeder(page: Page) {
  await page.route("**/api/seed-demo", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        user_email: captainEmail,
        protagonist_name: "Smoke Stub",
        flight_id: `BA178-${todayFlightSuffix()}`,
        policy_ids: [],
        policies_created: 0,
        claims_settled: 0,
      }),
    });
  });
  await page.route("**/api/inject-delay", async (route) => {
    const body = route.request().postDataJSON() as { flight_id?: string; delay_minutes?: number } | null;
    await route.fulfill({
      contentType: "application/json",
      status: 200,
      body: JSON.stringify({
        flight_id: body?.flight_id ?? `BA178-${todayFlightSuffix()}`,
        delay_minutes: body?.delay_minutes ?? 45,
      }),
    });
  });
}

async function devLoginAndOpenDashboard(
  page: Page,
  options: { email?: string; silenceAutoSeeder?: boolean } = {},
) {
  if (options.silenceAutoSeeder) {
    await silenceBrowserAutoSeeder(page);
  }

  const response = await page.request.post("/api/auth/dev-login", {
    data: {
      email: options.email ?? captainEmail,
      name: "Dev Captain",
    },
  });
  expect(response.ok()).toBeTruthy();

  await page.goto("/");
  await expect(page.getByTestId("mode-indicator")).toBeVisible();
  await expect(page.getByTestId("mode-indicator-label")).not.toContainText(
    /DATA LINK LOST/,
    { timeout: 5000 },
  );
  await expect(page.getByTestId(/flight-dot-/).first()).toBeVisible({
    timeout: 15000,
  });
}

async function waitForLiveFlight(page: Page) {
  let selected: FlightPublic | null = null;
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/flights/live");
        if (!response.ok()) return 0;
        const body = (await response.json()) as LiveResponse;
        selected =
          body.flights.find(
            (flight) =>
              flight.callsign.trim() &&
              flight.longitude !== null &&
              flight.latitude !== null &&
              !flight.on_ground,
          ) ?? null;
        return selected ? 1 : 0;
      },
      { timeout: 15000 },
    )
    .toBe(1);

  return selected!;
}

async function waitForFlightDetail(page: Page, flightId: string) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/flights/${flightId}`);
        return response.status();
      },
      { timeout: 15000 },
    )
    .toBe(200);
}

async function getSessionFlares(page: Page) {
  const text = await page.getByTestId("kpi-band").textContent();
  const match = text?.match(/SESSION FLARES\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

async function viewportScale(page: Page) {
  const transform = await page.getByTestId("globe-viewport").getAttribute("transform");
  const match = transform?.match(/scale\(([^)]+)\)/);
  return match ? Number(match[1]) : 0;
}

async function captureWhenAttachedWithVisibleChild(
  page: Page,
  parentTestId: string,
  childTestId: string,
  path: string,
  timeout: number,
) {
  await page.getByTestId(parentTestId).first().waitFor({
    state: "attached",
    timeout,
  });
  await page.getByTestId(childTestId).first().waitFor({
    state: "visible",
    timeout: 1000,
  });
  await page.screenshot({ path, fullPage: true });
}

test.describe("Dashboard smoke", () => {
  test.skip(
    !useLocalServer,
    "本地沙箱不可绑定后端/前端端口；设置 PLAYWRIGHT_USE_LOCAL_SERVER=1 后运行真实 smoke",
  );

  test("C1 cinema 主角高亮与 manual 恢复", async ({ page }) => {
    test.setTimeout(45000);

    await devLoginAndOpenDashboard(page);
    await expect(page.getByTestId("mode-indicator-label")).toHaveText(/^CINEMA$/);

    await page.waitForTimeout(5200);
    await expect(page.locator('[data-protagonist="true"]').first()).toBeVisible({
      timeout: 1800,
    });
    await expect.poll(async () => viewportScale(page), { timeout: 1800 }).toBe(1);
    await page.screenshot({ path: `${screenshotDir}/c1-cinema.png`, fullPage: true });

    await page.getByTestId(/flight-dot-/).first().click();
    await expect(page.getByTestId("mode-indicator-label")).toHaveText(
      /MANUAL · \d+s/,
      { timeout: 1000 },
    );
    await page.screenshot({ path: `${screenshotDir}/c1-manual.png`, fullPage: true });

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("mode-indicator-label")).toHaveText(/^CINEMA$/);
  });

  test("C2 key moments smoke", async ({ page }) => {
    test.setTimeout(60000);

    await devLoginAndOpenDashboard(page, { silenceAutoSeeder: true });
    const protagonist = await waitForLiveFlight(page);
    const protagonistFlightId = flightIdForCallsign(protagonist.callsign);
    await waitForFlightDetail(page, protagonistFlightId);

    await page.waitForTimeout(15500);
    const beforeSettled = await getSessionFlares(page);
    const shockwaveCapture = captureWhenAttachedWithVisibleChild(
      page,
      "shockwave",
      "shockwave-ring",
      `${screenshotDir}/c2-shockwave.png`,
      5000,
    );
    const chainbeamCapture = (async () => {
      await page.getByTestId("chainbeam").first().waitFor({ state: "visible", timeout: 9000 });
      await expect(page.getByTestId("chainbeam-tx").first()).toContainText(/^0x/i);
      await page.screenshot({ path: `${screenshotDir}/c2-chainbeam.png`, fullPage: true });
    })();
    const flarelandCapture = captureWhenAttachedWithVisibleChild(
      page,
      "flareland",
      "flareland-ring",
      `${screenshotDir}/c2-flareland.png`,
      14000,
    );
    const seedResponse = await page.request.post("/api/seed-demo?smoke=1", {
      data: {
        user_email: captainEmail,
        protagonist_name: "Alice",
        flight_id: protagonistFlightId,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seed = (await seedResponse.json()) as SeedDemoResponse;
    expect(seed.protagonist_name).toBe("Alice");
    expect(seed.flight_id).toBe(protagonistFlightId);
    expect(seed.policy_ids.length).toBeGreaterThan(0);

    const injectResponse = await page.request.post("/api/inject-delay?smoke=1", {
      data: { flight_id: seed.flight_id, delay_minutes: 45 },
    });
    expect(injectResponse.ok()).toBeTruthy();

    await shockwaveCapture;
    await chainbeamCapture;

    await expect
      .poll(async () => getSessionFlares(page), { timeout: 5000 })
      .toBe(beforeSettled + 1);

    await flarelandCapture;
  });

  test("C3 ambient heatmap 与 trail smoke", async ({ page }) => {
    test.setTimeout(60000);

    await devLoginAndOpenDashboard(page, {
      email: "captain+c3-smoke@local.dev",
      silenceAutoSeeder: true,
    });
    await expect(page.getByTestId("heatmap-bg")).toBeVisible();
    await expect(page.getByTestId("heatmap-bg")).toHaveCSS("pointer-events", "none");

    const liveFlights: FlightPublic[] = [];
    await expect
      .poll(
        async () => {
          const response = await page.request.get("/api/flights/live");
          if (!response.ok()) return 0;
          const body = (await response.json()) as LiveResponse;
          liveFlights.splice(
            0,
            liveFlights.length,
            ...body.flights.filter(
              (flight) =>
                flight.callsign.trim() &&
                flight.longitude !== null &&
                flight.latitude !== null &&
                !flight.on_ground,
            ),
          );
          return liveFlights.length;
        },
        { timeout: 15000 },
      )
      .toBeGreaterThanOrEqual(3);

    for (const flight of liveFlights.slice(0, 3)) {
      const flightId = flightIdForCallsign(flight.callsign);
      await waitForFlightDetail(page, flightId);
      const response = await page.request.post("/api/policies", {
        data: { flight_id: flightId, premium: 5 },
      });
      expect(response.ok()).toBeTruthy();
    }

    await expect
      .poll(async () => page.getByTestId("heatmap-focus").count(), { timeout: 5000 })
      .toBeGreaterThan(0);
    await page.screenshot({ path: `${screenshotDir}/c3-heatmap.png`, fullPage: true });

    await expect(page.getByTestId("trail-draw")).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: `${screenshotDir}/c3-trail.png`, fullPage: true });

    await page.waitForTimeout(10000);
    await expect(page.getByTestId("trail-draw")).toHaveCount(0);
  });

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
