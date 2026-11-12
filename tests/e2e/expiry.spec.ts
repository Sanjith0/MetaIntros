import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady, lockIn } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("fast-forward archives the squad chat: read-only + stay-in-touch prompt", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-boulder-social");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-rwc-courthouse").click();
  await lockIn(page, 30_000);
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
    await lockIn(page, 30_000);
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
