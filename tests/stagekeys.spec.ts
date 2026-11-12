import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForLock } from "./helpers";

/* F47: the presenter drives the projector from the keyboard. */

test("presenter keys: help, step, start, live, public screen and captions, all from the keyboard", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();
  await waitForLock(page, 90_000);
  await page.locator("body").click({ position: { x: 5, y: 880 } }); // take focus off the button

  await page.keyboard.press("?");
  await expect(page.getByTestId("keys-help")).toBeVisible();
  const axe = await new AxeBuilder({ page }).include("[data-testid=keys-help]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: "shots/f47-keys.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("keys-help")).toHaveCount(0);

  await page.keyboard.press("Home");
  await expect(page.getByTestId("scrubber")).toHaveValue("0");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("scrubber")).toHaveValue("2");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByTestId("scrubber")).toHaveValue("12");
  await page.keyboard.press("l");
  await expect(page.getByTestId("stage-status")).toHaveText("Locked");

  await page.keyboard.press("p");
  await expect(page.getByTestId("public-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("stage-public")).toBeVisible();
  await page.keyboard.press("p");
  await expect(page.getByTestId("public-toggle")).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("c");
  await expect(page.getByTestId("stage-caption")).toHaveCount(0);
  await page.keyboard.press("c");
  await expect(page.getByTestId("stage-caption")).toBeVisible();

  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  await expect(page.getByTestId("play")).toHaveAttribute("aria-label", "Pause");
});
