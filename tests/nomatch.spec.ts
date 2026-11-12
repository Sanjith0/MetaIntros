import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F22: no plan fits all five. Everyone is back at the front of the queue; nobody is blamed; the projector says "No match". */

test("no match: Maya's phone says no plan fit all five, nobody blamed, back at the front of the queue", async ({ browser, page, request, baseURL }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/events");
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  // From the presenter's panel: five whose rules clash.
  const demo = await browser.newPage();
  await demo.goto("/demo");
  await demo.getByTestId("demo-clash").click();
  await expect(demo.getByTestId("demo-msg")).toContainText("Queued five whose rules clash");
  await demo.close();

  await expect(page.getByTestId("stage-status")).toHaveText("No match", { timeout: 90_000 });
  await expect(page.locator('[data-testid="stage-plans"] [data-state="unavailable"]')).toHaveCount(5);
  await expect(page.locator('[data-testid="trace-shared"]', { hasText: "No match · nobody blamed" })).toHaveCount(1);
  await page.locator('[data-testid="trace-shared"]', { hasText: "No match · nobody blamed" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f22-stage-nomatch.png", animations: "disabled" });

  // Maya's phone: a toast, then her party page.
  await expect(maya.getByText("No plan fit all five of you. Nobody was told why.")).toBeVisible({ timeout: 30_000 });
  await maya.goto("/party");
  await expect(maya.getByTestId("party-status")).toHaveText("No plan fit all five of you");
  await expect(maya.getByTestId("nomatch")).toHaveAttribute("data-requeued", "true");
  await expect(maya.getByTestId("nomatch-queue")).toContainText("You're back at the front of the queue near Dolores Park.");
  await expect(maya.getByTestId("nomatch-queue")).toContainText("You won't be matched with these same five again tonight.");
  // Neither clashing rule is on her screen (Ana's curfew, Zoe's budget).
  const text = await maya.locator("main").innerText();
  for (const w of ["home by 9:30", "budget around 15", "9:30 PM", "$15 or less"]) expect(text).not.toContain(w);
  const axe = await new AxeBuilder({ page: maya }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await maya.screenshot({ path: "shots/f22-phone-nomatch.png", fullPage: true });
  await ctx.close();
});
