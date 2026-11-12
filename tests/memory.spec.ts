import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F39: after the night Maya says it was too loud; next time her private preview offers "prefers quiet". */

test("your agent remembers, with your OK: too loud → prefers quiet, offered in the next private preview", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/runitback");
  const card = page.getByTestId("memory-card");
  await expect(card).toContainText("How was Dolores Night Market for you?");
  await page.getByTestId("feeling-loud").click();
  await expect(page.getByTestId("remember-quiet")).toBeChecked();
  await page.getByTestId("memory-save").click();
  await expect(page.getByTestId("memory-now")).toContainText("Your agent remembers: prefers quiet.");
  const axe = await new AxeBuilder({ page }).include("[data-testid=memory-card]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await card.screenshot({ path: "shots/f39-memory.png" });

  // Sunday: her private preview offers it, and she can leave it out.
  await page.goto("/queue?event=evt-ferry-trivia");
  await page.getByTestId("sentence").fill("trivia sounds fun, out by eleven");
  const mem = page.getByTestId("memory-preview");
  await expect(mem).toContainText("From last time");
  await expect(mem).toContainText("prefers quiet");
  await expect(page.getByTestId("use-memory")).toBeChecked();
  await mem.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f39-memory-preview.png" });

  // And she can make her agent forget.
  await page.goto("/runitback");
  await page.getByTestId("memory-forget").click();
  await expect(page.getByTestId("memory-now")).toHaveText("Your agent remembers nothing.");
  await ctx.close();
});
