import { expect, test } from "@playwright/test";
import { waitForLock } from "./helpers";

/* F52: big text on the projector for a large room: B toggles it, ?big=1 opens with it, and the stage still fits the screen. */

test("big text: B scales the projector up, keeps it on screen, and the URL remembers", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();
  await waitForLock(page, 90_000);
  await page.locator("body").click({ position: { x: 5, y: 880 } });
  const before = await page.getByTestId("stage-caption").evaluate((el) => el.getBoundingClientRect().height);
  await page.keyboard.press("b");
  await expect(page.getByTestId("stage")).toHaveAttribute("data-big", "true");
  await expect(page).toHaveURL(/big=1/);
  const after = await page.getByTestId("stage-caption").evaluate((el) => el.getBoundingClientRect().height);
  expect(after).toBeGreaterThan(before * 1.2);
  // Still fits: nothing wider than the screen.
  const wide = await page.evaluate(() => [...document.querySelectorAll("[data-testid=stage] *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).length);
  expect(wide).toBe(0);
  await page.screenshot({ path: "shots/f52-big-text.png", animations: "disabled" });
  await page.reload();
  await expect(page.getByTestId("stage")).toHaveAttribute("data-big", "true");
  await page.locator("body").click({ position: { x: 5, y: 880 } });
  await page.keyboard.press("b");
  await expect(page.getByTestId("stage")).toHaveAttribute("data-big", "false");
});
