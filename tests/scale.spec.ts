import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F30: a whole fair (100 guests) through the real loop in a sandbox; a live phone hears nothing. */

test("at fair scale: 100 guests, 20 parties locked, no invalid plans, no leaks, nothing live", async ({ browser, baseURL, request, page }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/events");
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/evals");
  const box = page.getByTestId("scale");
  await box.getByRole("button", { name: "100", exact: true }).click();
  await page.getByTestId("scale-run").click();
  const res = page.getByTestId("scale-result");
  await expect(res).toBeVisible({ timeout: 60_000 });
  await expect(res).toContainText("Parties formed20 (20 locked)");
  await expect(res).toContainText("Locked plans that break someone's rule0");
  await expect(res).toContainText("Private words another member can load (100 members scanned)0");
  await expect(res).toContainText("Prompts that held someone else's words0");
  await expect(res).toContainText("Real model calls0");
  const axe = await new AxeBuilder({ page }).include("[data-testid=scale]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await box.screenshot({ path: "shots/f30-scale.png" });

  // Nothing live: no parties, and Maya's phone heard nothing.
  const status = (await (await request.get("/api/demo/status")).json()) as { party: unknown };
  expect(status.party ?? null).toBeNull();
  await expect(maya.getByTestId("toast")).toHaveCount(0);
  await ctx.close();
});
