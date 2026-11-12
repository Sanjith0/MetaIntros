import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F59: Kai leaves quietly from the door; Maya sees "Headed home" and one plain goodbye in the chat. */

test("leave quietly: one tap, one plain goodbye, no reason; the others see 'Headed home'", async ({ browser, baseURL, request }) => {
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
  const kai = await phone("kai");
  await kai.page.getByTestId("leave-quietly").click();
  await expect(kai.page.getByTestId("leave-quietly-confirm")).toContainText("No reason, nothing else.");
  await kai.page.getByTestId("leave-quietly-yes").click();
  await expect(kai.page.getByTestId("left-quietly")).toContainText("You don't owe anyone a reason.");
  await expect(kai.page.getByTestId("late-10")).toHaveCount(0); // no "running late" once you've headed home
  await expect(kai.page.getByTestId("left-friend-text")).toHaveText("Heading home now from Dolores Night Market. All good. I'll text you when I'm in.");
  const axe = await new AxeBuilder({ page: kai.page }).include("[data-testid=find-each-other]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await kai.page.getByTestId("find-each-other").scrollIntoViewIfNeeded();
  await kai.page.screenshot({ path: "shots/f59-leave-quietly.png" });
  await expect(maya.page.getByTestId("status-kai")).toHaveText("Headed home");
  await maya.page.goto("/party");
  await maya.page.getByRole("link", { name: "Group chat" }).click();
  await expect(maya.page.getByTestId("message-list")).toContainText("I'm heading off. Have a good night, everyone!");
  await maya.ctx.close();
  await kai.ctx.close();
});
