import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F36: Maya copies a message for a friend outside the app: place, time, check-in; no names. */

test("tell a friend: pick a check-in time, copy the message; it names nobody from the party", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  const box = page.getByTestId("tell-friend");
  await expect(page.getByTestId("tell-friend-text")).toContainText("I'll text you by 10:30 PM.");
  await box.getByRole("button", { name: "11 PM" }).click();
  await expect(page.getByTestId("tell-friend-text")).toHaveText(
    "Heads up: I'm going to Dolores Night Market at Dolores Park, upper lawn, Sat, Nov 14, 6 PM–10 PM, with four people I met through Party Queue. It's a public place. I'll text you by 11 PM.",
  );
  for (const n of ["Dev", "Ana", "Kai", "Zoe"]) await expect(page.getByTestId("tell-friend-text")).not.toContainText(n);
  await page.getByTestId("tell-friend-copy").click();
  await expect(page.getByTestId("tell-friend-copy")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("I'll text you by 11 PM.");
  const axe = await new AxeBuilder({ page }).include("[data-testid=tell-friend]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await box.screenshot({ path: "shots/f36-tell-friend.png" });
  await ctx.close();
});
