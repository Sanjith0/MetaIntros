import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F9: the glasses view and the door read the same Spotted events; a recorded clip is labelled as recorded. */

test("glasses: a recorded clip of arrivals, labelled as recorded, on glasses and on the door", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  try {
    await lockedParty(request);
    await request.post("/api/demo/frame-source", { data: { source: "recorded-clip" } });

    const glassesCtx = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await glassesCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    const glasses = await glassesCtx.newPage();
    await glasses.goto("/door/glasses");
    await expect(glasses.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await expect(glasses.getByTestId("glasses-idle")).toHaveText("Looking for your party…");

    const play = await request.post("/api/demo/clip", { data: { viewerId: "maya", speed: 2 } });
    expect(play.ok()).toBeTruthy();
    await expect(glasses.getByTestId("glasses-name")).toHaveText("Dev", { timeout: 5_000 });
    await expect(glasses.getByTestId("glasses-recorded")).toContainText("Recorded clip");
    await expect(glasses.getByTestId("glasses-say")).toContainText("Dev,");
    await glasses.screenshot({ path: "shots/f9-glasses-dev.png", animations: "disabled" });
    await expect(glasses.getByTestId("glasses-name")).toHaveText("Ana", { timeout: 5_000 });
    await expect(glasses.getByTestId("glasses-name")).toHaveText("Kai", { timeout: 10_000 });
    await glasses.screenshot({ path: "shots/f9-glasses-kai.png", animations: "disabled" });

    // Same Spotted on the phone's door view, with the same label.
    const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phoneCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    const phone = await phoneCtx.newPage();
    await phone.goto("/door");
    await expect(phone.getByTestId("door-card-name")).toHaveText("Kai");
    await expect(phone.getByTestId("door-recorded")).toHaveText("Recorded clip");
    await phone.screenshot({ path: "shots/f9-door-recorded.png", animations: "disabled" });

    // Only Maya was shown anything.
    const devCtx = await browser.newContext();
    await devCtx.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
    const dev = await devCtx.newPage();
    await dev.goto("/door/glasses");
    await expect(dev.getByTestId("glasses-idle")).toBeVisible();
    await Promise.all([glassesCtx.close(), phoneCtx.close(), devCtx.close()]);
  } finally {
    await request.post("/api/demo/frame-source", { data: { source: "fixture" } });
  }
});
