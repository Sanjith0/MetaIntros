import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F37: Dev says he's running late; Maya sets where to meet; both see it live on their door screens. */

test("find each other: running late and where we meet, live on both phones", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const phone = async (who: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto("/door");
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    return { ctx, page };
  };
  const maya = await phone("maya");
  const dev = await phone("dev");

  await dev.page.getByTestId("late-10").click();
  await expect(dev.page.getByTestId("door-msg")).toHaveText("You told your party: about 10 minutes late.");
  await expect(maya.page.getByTestId("status-dev")).toHaveText("~10 min late");

  await maya.page.getByTestId("im-here").click();
  await maya.page.getByTestId("meet-input").fill("by the big fountain, blue jacket");
  await maya.page.getByTestId("meet-share").click();
  await expect(maya.page.getByTestId("door-meet")).toContainText("Let's meet: by the big fountain, blue jacket");
  await expect(dev.page.getByTestId("door-meet")).toContainText("Let's meet: by the big fountain, blue jacket");
  await expect(dev.page.getByTestId("door-meet")).toContainText("Maya");
  const axe = await new AxeBuilder({ page: dev.page }).include("[data-testid=find-each-other]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await dev.page.getByTestId("find-each-other").scrollIntoViewIfNeeded();
  await dev.page.screenshot({ path: "shots/f37-find-each-other.png" });

  // Dev arrives: no longer late on Maya's screen.
  await dev.page.getByTestId("im-here").click();
  await expect(maya.page.getByTestId("status-dev")).toHaveText("Here");
  await maya.ctx.close();
  await dev.ctx.close();
});
