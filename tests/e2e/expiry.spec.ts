import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("fast-forward archives the squad chat: read-only + stay-in-touch prompt", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-boulder-social");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-rwc-courthouse").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByTestId("msg-host").first()).toBeVisible();
  await expect(page.getByTestId("composer")).toBeVisible();

  await page.request.post("/api/demo/fast-forward"); // presenter's /demo control; the open chat archives live
  await expect(page.getByTestId("read-only")).toBeVisible();
  await expect(page.getByTestId("stay-in-touch")).toBeVisible();
  await expect(page.getByTestId("composer")).toHaveCount(0);
  await expect(page.getByTestId("chat-thread")).toHaveAttribute("data-archived", "true");
  await gotoReady(page, "/chats");
  await expect(page.locator('[data-testid^="inbox-row-"][data-type="squad"]').getByTestId("squad-expiry")).toContainText("Chat ended");
});

test("global clock: Fast-forward ends the event for everyone; Reset & reseed keeps the clock and the demo works again", async ({ page }) => {
  const queueForBouldering = async () => {
    await gotoReady(page, "/queue/start?eventId=ev-boulder-social");
    await page.getByTestId("size-4").click();
    await page.getByTestId("choose-area").click();
    await page.getByTestId("area-lm-rwc-courthouse").click();
    await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  };
  await queueForBouldering();
  await page.getByTestId("open-squad-chat").click();
  await page.request.post("/api/demo/fast-forward"); // the presenter's /demo control
  await expect(page.getByTestId("read-only")).toBeVisible();

  await gotoReady(page, "/demo");
  await expect(page.getByTestId("global-clock")).toContainText("fast-forwarded");
  await page.getByTestId("demo-reset").click();
  await expect(page.getByTestId("demo-reset")).toContainText("Reset & reseed");
  await expect(page.getByTestId("global-clock")).toContainText("fast-forwarded"); // never snapped back

  // the same scripted path works again, on the same clock
  await queueForBouldering();
});

test("live demo: judges squad up, presenter presses Fast-forward on /demo, the judges' chat ends", async ({ browser, page, request }) => {
  await request.post("/api/demo/settings", { data: { fillMode: "live" } });
  const judges: import("@playwright/test").Page[] = [];
  for (const name of ["Ana", "Ben"]) {
    const p = await (await browser.newContext()).newPage();
    await gotoReady(p, "/join");
    await p.getByTestId("join-name").fill(name);
    await p.getByTestId("join-age-18-24").click();
    await p.getByTestId("join-gender-none").click();
    await p.getByTestId("join-sample").click();
    await expect(p).toHaveURL(/\/events/);
    judges.push(p);
  }
  // size 2 via the API (the UI offers 4–6); same queue for both
  for (const p of judges) {
    const r = await p.request.post("/api/queue/join", { data: { mode: "events", eventId: "ev-indie-guild", targetSize: 2, landmarkId: "lm-downtown-pa", locationSource: "manual" } });
    expect(r.ok()).toBe(true);
  }
  await expect.poll(async () => (await (await judges[0].request.get("/api/queue/status")).json()).state, { timeout: 20_000 }).toBe("matched");
  await gotoReady(judges[0], "/queue");
  await judges[0].getByTestId("open-squad-chat").click();
  await expect(judges[0].getByTestId("composer")).toBeVisible();

  // the presenter's /demo browser (Jordan) isn't in that squad
  await gotoReady(page, "/demo");
  await page.getByTestId("demo-ff").click();
  await expect(page.getByTestId("ff-result")).toContainText("Ended Indie Night");
  await expect(page.getByTestId("global-clock")).toContainText("fast-forwarded");
  await expect(judges[0].getByTestId("read-only")).toBeVisible({ timeout: 10_000 });

  // nothing else to end
  await page.getByTestId("demo-ff").click();
  await expect(page.getByTestId("ff-result")).toContainText("No active squad to end yet");
});
