import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F7: ties are shown without naming third people who never opted in. */

test("bridge lines: a tie without a name, on the party card and at the door", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();

  await page.goto("/party");
  const members = page.getByTestId("party-members");
  await expect(members.locator("li").filter({ hasText: "Dev Raman" })).toContainText("You have a friend in common.");
  await expect(members.locator("li").filter({ hasText: "Zoe Lindqvist" })).toContainText("You're both in Portuguese Practice SF.");
  await members.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f7-party-bridges.png", animations: "disabled" });

  await page.goto("/door");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("tap-dev").tap();
  await expect(page.getByTestId("door-card")).toContainText("You have a friend in common.");
  await page.screenshot({ path: "shots/f7-door-bridge.png", animations: "disabled" });

  // Priya (Maya and Dev's mutual friend) and Theo never joined: nothing in the party's pages names them.
  // (The demo user switcher lists every fictional person; that's the menu, so we check the page itself.)
  for (const path of ["/party", "/door", "/runitback"]) {
    await page.goto(path);
    const text = await page.locator("main").innerText();
    for (const name of ["Priya", "Theo Barros", "Sam Whitfield"]) expect(text, `${path} names ${name}`).not.toContain(name);
  }
  await ctx.close();
});
