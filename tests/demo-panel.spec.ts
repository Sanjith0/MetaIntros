import { expect, test } from "@playwright/test";

/* F5: drive the demo from /demo: reset, pre-queue, slow pace, lock now, frames, camera off. */

test("demo control panel: reset, pre-queue four, lock now, switch frame source", async ({ page, browser, baseURL, request }) => {
  test.setTimeout(150_000);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/demo");
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await page.getByTestId("demo-reset").click();
    await expect(page.getByTestId("demo-msg")).toHaveText("Reset: done");

    // Maya's phone is open and waiting.
    const maya = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await maya.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    const phone = await maya.newPage();
    await phone.goto("/events");
    await expect(phone.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

    await page.getByTestId("pace-slow").click();
    await page.getByTestId("demo-queue-four").click();
    await expect(page.getByTestId("demo-waiting")).toHaveText("4");
    await page.getByTestId("demo-run-all").click();
    await expect(page.getByTestId("demo-party-status")).toContainText("talking", { timeout: 15_000 });

    // At the slow pace this would take half a minute; Lock now ends it.
    const t0 = Date.now();
    await page.getByTestId("demo-lock").click();
    await expect(page.getByTestId("demo-party-status")).toHaveText("locked", { timeout: 10_000 });
    await expect(page.getByTestId("demo-plan")).toContainText("locked by operator");
    await expect(phone.getByTestId("match-found")).toBeVisible({ timeout: 10_000 });
    console.log(`Lock now -> MATCH FOUND on Maya's phone in ${Date.now() - t0} ms`);

    // Frames: Dev arrives at Maya's door.
    await phone.goto("/door");
    await expect(phone.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await page.getByTestId("frame-dev").click();
    await expect(phone.getByTestId("door-card-name")).toHaveText("Dev");
    await page.screenshot({ path: "shots/f5-demo.png", animations: "disabled" });

    // Camera off: frames are refused and the door says so.
    await page.getByTestId("frames-tap-only").click();
    await expect(page.getByTestId("frame-ana")).toBeDisabled();
    const refused = await request.post("/api/demo/frame", { data: { subjectId: "ana", viewerId: "maya" } });
    expect(refused.status()).toBe(409);
    await request.post("/api/demo/reset?keepSettings=1");
    await request.post("/api/demo/settings", { data: { paceMs: 0 } });
    await request.post("/api/demo/start", { data: { mode: "all" } });
    await expect
      .poll(async () => ((await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { status: string } } | null }).view?.party.status, {
        timeout: 60_000,
      })
      .toBe("locked");
    await phone.goto("/door");
    await expect(phone.getByTestId("door-camera-state")).toContainText("The door camera is off");
    await phone.screenshot({ path: "shots/f5-door-camera-off.png", animations: "disabled" });
    await maya.close();
  } finally {
    await request.delete("/api/demo/settings");
    await request.post("/api/demo/frame-source", { data: { source: "fixture" } });
  }
});
