import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F32: "Why this?" under each suggested opener and the pinned plan in the group chat. */

test("why this, in the chat: the pinned plan and an opener explain where they came from", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  await page.getByRole("link", { name: "Group chat" }).click();
  await expect(page.getByTestId("opener-message")).toHaveCount(5);

  // The pinned plan.
  const pinnedWhy = page.locator('[data-testid^="why-"]').first();
  await pinnedWhy.getByText("Why this?").click();
  await expect(pinnedWhy).toContainText("Your party's plan: Dolores Night Market.");

  // Maya's own opener to Dev: built from Dev's approved fact.
  const row = page.getByTestId("opener-message").filter({ hasText: "Dev, what's worth buying at the market right now?" });
  const mine = page.getByTestId(`why-${await row.getAttribute("data-message-id")}`);
  await mine.getByText("Why this?").click();
  await expect(mine).toContainText("Dev listed “farmers market” on their profile and approved sharing it.");
  await expect(mine).toContainText("The model only chose which facts.");
  await mine.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f32-chat-why.png" });
  await ctx.close();
});
