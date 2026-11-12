import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F31: each phone's receipt tells how its own agent negotiated; Kai's held out, then agreed. */

test("how your agent did it: Maya's and Kai's receipts tell their own agent's moves, and only theirs", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const phone = async (who: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto("/party");
    return { ctx, page };
  };
  const maya = await phone("maya");
  const story = maya.page.getByTestId("agent-story");
  await expect(story.locator("li")).toHaveText([
    "R1Read 5 plans. Turned down 3 that break your rules. Liked Dolores Night Market most (5/5).",
    "R2Signed Dolores Night Market.",
    "R3Kept its signature on Dolores Night Market while the others caught up.",
    "LockCode locked Dolores Night Market with all five signatures.",
  ]);
  await story.scrollIntoViewIfNeeded();
  const axe = await new AxeBuilder({ page: maya.page }).include("[data-testid=agent-story]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await maya.page.screenshot({ path: "shots/f31-story-maya.png" });

  const kai = await phone("kai");
  await expect(kai.page.getByTestId("agent-story")).toContainText("Held out for");
  await expect(kai.page.getByTestId("agent-story")).toContainText("Agreed to Dolores Night Market: not your first pick, but it fits your rules.");
  await expect(kai.page.getByTestId("agent-story")).not.toContainText("Maya");
  await kai.page.getByTestId("agent-story").scrollIntoViewIfNeeded();
  await kai.page.screenshot({ path: "shots/f31-story-kai.png" });
  await maya.ctx.close();
  await kai.ctx.close();
});
