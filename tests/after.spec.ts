import { expect, test, type Page } from "@playwright/test";
import { lockedParty } from "./helpers";

/* M6 proof (UI): /runitback shows only mutual picks, pair by pair; /fair joins by QR with a typed profile and consent. */

async function ready(page: Page) {
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
}

test("runitback: private picks, mutual pairs only, shown pair by pair", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  // Dev and Zoe already picked privately: Dev picked Maya and Kai; Zoe picked Kai only.
  await request.post("/api/runitback", { data: { partyId, pickedIds: ["maya", "kai"] }, headers: { cookie: "pq_viewer=dev" } });
  await request.post("/api/runitback", { data: { partyId, pickedIds: ["kai"] }, headers: { cookie: "pq_viewer=zoe" } });

  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/runitback");
  await ready(page);
  await page.getByTestId("pick-dev").click();
  await page.getByTestId("pick-zoe").click();
  await page.screenshot({ path: "shots/m6-runitback-picks.png", animations: "disabled" });
  await page.getByTestId("save-picks").click();

  await expect(page.getByTestId("mutual-dev")).toBeVisible();
  await expect(page.getByTestId("runitback-done")).toBeVisible();
  // Maya picked Zoe, but Zoe did not pick Maya: nothing about Zoe shows.
  await expect(page.getByTestId("mutual-zoe")).toHaveCount(0);
  await page.screenshot({ path: "shots/m6-runitback-mutual.png", animations: "disabled" });

  // Zoe sees no mutual pair and nothing about who picked her.
  const z = await browser.newContext();
  await z.addCookies([{ name: "pq_viewer", value: "zoe", url: baseURL! }]);
  const zp = await z.newPage();
  await zp.goto("/runitback");
  await expect(zp.getByTestId("runitback-results")).toBeVisible();
  await expect(zp.locator("[data-testid^=mutual-]")).toHaveCount(0);
  expect(await zp.content()).not.toContain("Maya picked");
  await Promise.all([ctx.close(), z.close()]);
});

test("fair: QR join with a typed profile and a consent box", async ({ page, request }) => {
  await request.post("/api/demo/reset");
  await page.goto("/fair");
  await expect(page.getByTestId("fair-qr").locator("svg")).toBeVisible();
  await page.screenshot({ path: "shots/m6-fair-qr.png", animations: "disabled" });

  await page.getByTestId("fair-open-form").click();
  await expect(page.getByTestId("fair-form")).toBeVisible();
  await ready(page);
  await page.getByTestId("fair-name").fill("Robin");
  await page.getByTestId("fair-age").fill("29");
  await page.getByTestId("fair-sentence").fill("board games or anything chill, home by ten");
  await page.getByTestId("fair-tag-0").fill("ukulele");
  await page.getByTestId("fair-text-0").fill("Plays in a ukulele band");
  // Without consent, you cannot join.
  await expect(page.getByTestId("fair-join")).toBeDisabled();
  await page.getByTestId("fair-consent").check();
  await expect(page.getByTestId("fair-join")).toBeEnabled();
  await page.screenshot({ path: "shots/m6-fair-form.png", animations: "disabled" });
  await page.getByTestId("fair-join").click();

  await page.waitForURL("**/queue");
  await expect(page.getByTestId("queue-waiting")).toBeVisible();
  await expect(page.getByTestId("queue-count")).toContainText("1 of 5");
  await page.screenshot({ path: "shots/m6-fair-queued.png", animations: "disabled" });
});
