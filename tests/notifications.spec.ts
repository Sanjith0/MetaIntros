import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F58: the bell counts unread Party Queue notifications; the list keeps them; opening it marks them seen. */

test("notifications: the bell counts what Maya missed, the list keeps it, and opening it clears the count", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request); // Maya's phone was off for all of it
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/events");
  await expect(page.getByTestId("bell-count")).toHaveText("2");
  await expect(page.getByTestId("bell")).toHaveAttribute("aria-label", "Notifications, 2 unread");
  await page.getByTestId("bell").click();
  await expect(page).toHaveURL(/\/notifications$/);
  const items = page.getByTestId("notification");
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("MATCH FOUND: Dolores Night Market");
  await expect(items.nth(1)).toContainText("Your party of five is forming.");
  await page.screenshot({ path: "shots/f58-notifications.png" });
  await page.goto("/events");
  await expect(page.getByTestId("bell-count")).toHaveCount(0);
  // Something new while she's away: the count comes back.
  for (const who of ["dev", "kai", "zoe"]) await request.post("/api/party/switch", { data: { partyId }, headers: { cookie: `pq_viewer=${who}` } });
  await page.reload();
  await expect(page.getByTestId("bell-count")).toHaveText("1");
  await ctx.close();
});
