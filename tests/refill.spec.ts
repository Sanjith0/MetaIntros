import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F42: after the lock Maya can't make it; Sam, waiting nearby, takes the seat; Dev is told one person couldn't make it, not who. */

test("can't make it: the seat goes to someone waiting nearby, and nobody is told who left", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  await request.post("/api/queue/join", { data: { eventId: "evt-rooftop", sentence: "anything chill works for me", consentBridges: true }, headers: { cookie: "pq_viewer=sam" } });
  const phone = async (who: string, path: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto(path);
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    return { ctx, page };
  };
  const dev = await phone("dev", "/party");
  const sam = await phone("sam", "/events");
  const maya = await phone("maya", "/party");

  await maya.page.getByTestId("cant-make-it").click();
  await expect(maya.page.getByTestId("cant-confirm")).toContainText("The others are told one person couldn't make it, not who.");
  await maya.page.screenshot({ path: "shots/f42-cant-make-it.png" });
  await maya.page.getByTestId("cant-yes").click();
  await expect(maya.page.getByTestId("cantmake-done")).toBeVisible();

  // Dev: a toast that names nobody, then Sam on his party card.
  await expect(dev.page.getByText("One person couldn't make it. Someone new is taking the seat.")).toBeVisible({ timeout: 15_000 });
  await expect(dev.page.getByTestId("party-members")).toContainText("Sam", { timeout: 15_000 });
  await expect(dev.page.getByTestId("party-members")).not.toContainText("Maya");
  await dev.page.screenshot({ path: "shots/f42-refilled.png" });

  // Sam: MATCH FOUND for a plan that was already set.
  await expect(sam.page.getByTestId("match-found")).toBeVisible({ timeout: 15_000 });
  await expect(sam.page.getByTestId("match-found")).toContainText("Dolores Night Market");
  for (const p of [dev, sam, maya]) await p.ctx.close();
});
