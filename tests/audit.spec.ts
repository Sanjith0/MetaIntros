import { expect, test } from "@playwright/test";

/* F19: every agent turn on the stage carries a context audit chip; tapping one shows the exact prompt. */

test("context audit: own brief only on every turn, and the exact prompt one tap away", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();
  await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 90_000 });

  const chips = page.getByTestId("context-chip");
  expect(await chips.count()).toBeGreaterThanOrEqual(10);
  await expect(page.locator('[data-testid="context-chip"]:not([data-others="0"])')).toHaveCount(0);
  await expect(chips.first()).toContainText("own brief only");

  await page.locator('[data-testid="context-chip"][data-actor="maya"][data-round="1"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f19-context-chips.png", animations: "disabled" });

  // Maya's agent, round 1: the prompt holds her words and none of Dev's.
  await page.locator('[data-testid="context-chip"][data-actor="maya"][data-round="1"]').click();
  const view = page.getByTestId("prompt-view");
  await expect(view).toBeVisible();
  await expect(page.getByTestId("prompt-audit")).toContainText("3 of its own rules, and none of the other four");
  const text = page.getByTestId("prompt-text");
  for (const w of ["out by eleven", "under twenty bucks", "nowhere I have to drink"]) await expect(text).toContainText(w);
  for (const w of ["fine spending up to 40", "home by midnight", "nothing too loud", "budget around 25"]) await expect(text).not.toContainText(w);
  await page.screenshot({ path: "shots/f19-context-audit.png", animations: "disabled" });

  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(view).toHaveCount(0);

  // The API refuses a prompt that was never recorded.
  expect((await request.get("/api/stage/prompt?party=nope&owner=maya&round=1")).status()).toBe(404);
});
