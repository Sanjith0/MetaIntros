import { expect, test } from "@playwright/test";

/* F48: the lock is a moment on the projector: MATCH FOUND, the plan, and how fast the phones that report it showed it. */

test("lock splash: MATCH FOUND on the projector, with the phones' measured lag", async ({ browser, baseURL, page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const phones = [];
  for (const who of ["maya", "dev"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const p = await ctx.newPage();
    await p.goto("/events");
    await expect(p.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    phones.push(ctx);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();

  const splash = page.getByTestId("lock-splash");
  await expect(splash).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("lock-splash-title")).toHaveText("Dolores Night Market");
  await expect(splash).toContainText("five signatures");
  await expect(page.getByTestId("lock-splash-acks")).toHaveText(/^2 phones showed it · slowest \d+ ms after the lock$/, { timeout: 4_000 });
  await page.screenshot({ path: "shots/f48-lock-splash.png", animations: "disabled" });
  // It doesn't block the presenter, and it clears by itself.
  await page.getByTestId("go-live").click();
  await expect(splash).toHaveCount(0, { timeout: 8_000 });
  await expect(page.getByTestId("stage-status")).toHaveText("Locked");
  for (const c of phones) await c.close();
});
