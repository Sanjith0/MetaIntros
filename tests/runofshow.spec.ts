import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F35: the run of show on /demo: nine timed beats, the clock highlights the current one, setup is one click. */

test("run of show: start the clock, set up in one click, and the current beat follows the time", async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.post("/api/demo/reset");
  await page.clock.install();
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto("/demo");
  const ros = page.getByTestId("run-of-show");
  await expect(ros.locator("li")).toHaveCount(9);
  await page.getByTestId("ros-start").click();
  await expect(page.getByTestId("beat-setup")).toHaveAttribute("data-now", "true");

  // One-click setup from the beat itself.
  await page.getByTestId("beat-setup").getByRole("button", { name: "Pre-queue Dev, Ana, Kai, Zoe" }).click();
  await expect(page.getByTestId("ros-msg")).toHaveText("Pre-queue Dev, Ana, Kai, Zoe: done");
  const st = (await (await request.get("/api/demo/status")).json()) as { queue?: unknown[]; waiting?: number };
  expect(JSON.stringify(st)).toContain("dev");

  // A minute in: the table is the beat.
  await page.clock.fastForward("01:05");
  await expect(page.getByTestId("beat-table")).toHaveAttribute("data-now", "true");
  await expect(page.getByTestId("beat-setup")).toHaveAttribute("data-now", "false");
  await expect(page.getByTestId("ros-clock")).toContainText("1:05");
  const axe = await new AxeBuilder({ page }).include("[data-testid=run-of-show]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await ros.screenshot({ path: "shots/f35-run-of-show.png" });

  // Past five minutes: it says so.
  await page.clock.fastForward("04:10");
  await expect(ros.getByRole("status").first()).toContainText("Over time by 0:15");
});
