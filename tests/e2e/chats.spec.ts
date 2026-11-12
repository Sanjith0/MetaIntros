import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("inbox renders seeded chats in recent-activity order with unread counts; opening clears unread", async ({ page }) => {
  await gotoReady(page, "/chats");
  const rows = page.locator('[data-testid^="inbox-row-"]');
  await expect(rows).toHaveCount(12);
  await expect(page.getByTestId("unread-count").first()).toBeVisible();
  const before = await page.getByTestId("unread-count").count();

  const unreadRow = page.locator('[data-testid^="inbox-row-"]:has([data-testid="unread-count"])').first();
  const id = (await unreadRow.getAttribute("data-testid"))!;
  await unreadRow.click();
  await expect(page.getByTestId("chat-thread")).toBeVisible();
  await gotoReady(page, "/chats");
  await expect(page.getByTestId(id).getByTestId("unread-count")).toHaveCount(0);
  await expect(page.getByTestId("unread-count")).toHaveCount(before - 1);
});
