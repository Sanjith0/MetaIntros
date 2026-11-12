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

  await page.getByTestId("fast-forward").click();
  await expect(page.getByTestId("read-only")).toBeVisible();
  await expect(page.getByTestId("stay-in-touch")).toBeVisible();
  await expect(page.getByTestId("composer")).toHaveCount(0);
  await expect(page.getByTestId("chat-thread")).toHaveAttribute("data-archived", "true");
  await gotoReady(page, "/chats");
  await expect(page.locator('[data-testid^="inbox-row-"][data-type="squad"]').getByTestId("squad-expiry")).toContainText("Archived");
});

test("after fast-forward, /demo warns the clock is ahead; reset clock clears it", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-boulder-social");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-rwc-courthouse").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("open-squad-chat").click();
  await page.getByTestId("fast-forward").click();
  await expect(page.getByTestId("read-only")).toBeVisible();

  await gotoReady(page, "/demo");
  await expect(page.getByTestId("clock-warning")).toBeVisible();
  await page.getByTestId("clock-reset").click();
  await expect(page.getByTestId("clock-warning")).toHaveCount(0);
});
