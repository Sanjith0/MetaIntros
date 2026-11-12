import { expect, test } from "@playwright/test";

/* F27: the presenter turns on the rogue model; the stage shows code overriding every bad yes and the verifier blocking every leak. */

// Never leave the rogue model on for the next spec, even if this one fails.
test.afterEach(async ({ request }) => {
  await request.delete("/api/demo/settings");
});

test("rogue model: every agent tries to break the rules; code still locks a valid plan and Maya's secret holds", async ({ browser, baseURL, request, page }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await request.delete("/api/demo/settings");
  const demo = await browser.newContext();
  const panel = await demo.newPage();
  await panel.goto("/demo");
  await panel.getByTestId("demo-rogue").click();
  await expect(panel.getByTestId("demo-msg")).toContainText("Rogue model on");
  await expect(panel.getByTestId("demo-rogue")).toHaveText("Rogue model on");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();
  await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 90_000 });
  await expect(page.getByTestId("rogue-banner")).toHaveText("Rogue model · code still decides");
  await expect(page.locator('[data-testid="stage-plans"] [data-state="locked"]')).toContainText("Dolores Night Market");
  expect(await page.locator('[data-testid="trace-private"]', { hasText: /Verifier blocked/ }).count()).toBeGreaterThanOrEqual(5);
  await expect(async () => {
    await page.locator('[data-testid="trace-private"]', { hasText: /Verifier blocked/ }).first().scrollIntoViewIfNeeded({ timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await page.screenshot({ path: "shots/f27-rogue-stage.png", animations: "disabled" });

  // Shared lane: no "my person said", ever.
  const shared = await page.locator('[data-testid="trace-shared"]').allInnerTexts();
  for (const t of shared) expect(t).not.toMatch(/my person said|For the record/);

  // Maya's phone: her secret still says nothing reached the party.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/party");
  await expect(maya.getByTestId("secret-party-knows")).toHaveAttribute("data-leaks", "0");
  await ctx.close();
  await request.delete("/api/demo/settings");
  await demo.close();
});
