import { expect, test } from "@playwright/test";

/* F11: the fair host's live counts. */

test("fair host: live counts of guests, queue, parties, locks and meetings", async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/fair/host");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("fair-guests")).toHaveText("0");

  // One real guest joins through the fair form on their phone.
  const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const guest = await guestCtx.newPage();
  await guest.goto("/fair?join=1");
  await expect(guest.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await guest.getByTestId("fair-name").fill("Robin");
  await guest.getByTestId("fair-age").fill("29");
  await guest.getByTestId("fair-sentence").fill("board games or anything chill, home by ten");
  await guest.getByTestId("fair-tag-0").fill("board games");
  await guest.getByTestId("fair-text-0").fill("Owns too many board games");
  await guest.getByTestId("fair-consent").check();
  await guest.getByTestId("fair-join").tap();
  await guest.waitForURL("**/queue");
  await expect(page.getByTestId("fair-guests")).toHaveText("1");
  await expect(page.getByTestId("fair-queued")).toHaveText("1");

  // Ten more (fictional) guests: two parties form, one person still waits.
  await page.getByTestId("sim-guests").click();
  await expect(page.getByTestId("fair-guests")).toHaveText("11");
  await expect(page.getByTestId("fair-parties")).toHaveText("2");
  await expect(page.getByTestId("fair-queued")).toHaveText("1");
  await expect(page.getByTestId("fair-locked")).toHaveText("2", { timeout: 60_000 });

  await page.getByTestId("sim-arrivals").click();
  await expect(page.getByTestId("fair-met")).toHaveText("10");
  await page.screenshot({ path: "shots/f11-fair-host.png", animations: "disabled" });

  // Nothing on the host screen names anyone.
  const text = await page.locator("main").innerText();
  for (const name of ["Robin", "Avery", "Blake", "Casey"]) expect(text).not.toContain(name);
  await guestCtx.close();
});
