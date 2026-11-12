import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForLock } from "./helpers";

/* F21: on the projector, take rules away and re-run the same five in a sandbox. */

test("what if: without both curfews and the drink rule, two plans open; the live party and phones are untouched", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("whatif-open")).toHaveCount(0); // only after a lock
  await page.getByTestId("stage-start").click();
  await waitForLock(page, 90_000);
  const partyBefore = await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).text();

  await page.getByTestId("whatif-open").click();
  const box = page.getByTestId("whatif");
  await expect(box).toBeVisible();
  await expect(box.getByRole("button", { name: "Close" })).toBeFocused();
  // Maya's drink rule is picked to start with.
  await expect(box.getByRole("button", { name: "No drink minimum" })).toHaveAttribute("aria-pressed", "true");
  await box.getByRole("button", { name: "Done by 11 PM" }).click();
  await box.getByRole("button", { name: "Done by 12 AM" }).click();
  await expect(page.getByTestId("whatif-run")).toHaveText("Run it without these 3 rules");
  await page.getByTestId("whatif-run").click();

  const result = page.getByTestId("whatif-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("Dolores Night Market still locks");
  await expect(page.getByTestId("whatif-sandbox").getByTestId("whatif-opened")).toHaveText(["Rooftop Sunset Session · opens up", "Late Synth Showcase · opens up"]);
  await expect(page.getByTestId("whatif-live")).toContainText("Rooftop Sunset Session · unavailable");
  await page.screenshot({ path: "shots/f21-whatif.png", animations: "disabled" });
  const axe = await new AxeBuilder({ page }).include("[data-testid=whatif]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(page.locator('[data-testid="trace-private"]', { hasText: "What if · without" })).toHaveCount(1);

  // Nothing live changed: Maya's party view is byte for byte the same.
  expect(await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).text()).toBe(partyBefore);
});
