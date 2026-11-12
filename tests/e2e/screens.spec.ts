import { expect, test, type Page } from "@playwright/test";
import { gotoReady, resetDemo, trackConsoleErrors } from "./helpers";

test.setTimeout(150_000);

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400); // let entrance animations settle
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name} has horizontal scroll`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/screens"}/${name}.png`, fullPage: false });
}

test("iPhone screenshots of every screen, no console errors, no horizontal scroll", async ({ page, request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 6000 } });
  const errors = trackConsoleErrors(page);

  for (const [url, name] of [
    ["/home", "01-home"], ["/events", "02-events-for-you"], ["/events?tab=nearby", "03-events-nearby"],
    ["/events?tab=weekend", "04-events-weekend"], ["/events/ev-indie-guild", "05-event-detail"],
    ["/events/ev-house-show", "06-event-private"], ["/chats", "07-chats"], ["/friends", "08-friends"],
    ["/friends?tab=requests", "09-friend-requests"], ["/friends?tab=queueup", "10-met-through-empty"],
    ["/profile", "11-profile"], ["/join", "12-join"], ["/demo", "13-demo-panel"], ["/nope", "14-not-found"],
  ] as const) {
    await gotoReady(page, url);
    await shot(page, name);
  }

  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await shot(page, "15-queue-setup");
  await page.getByTestId("choose-area").click();
  await shot(page, "16-area-picker");
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect.poll(() => page.getByTestId("player-filled").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await shot(page, "17-queue-filling");
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.getByTestId("trace-step").count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(8);
  await shot(page, "18-party-found-trace");
  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByTestId("msg-host").first()).toBeVisible();
  await shot(page, "19-squad-chat");
  await page.getByTestId("open-talk-cards").click();
  await expect(page.locator('[data-testid^="talk-card-"]').first()).toBeVisible();
  await shot(page, "20-talk-cards");
  await page.goBack();
  await page.getByTestId("im-here").click();
  await shot(page, "21-find-your-party");
  await page.getByTestId("fast-forward").click();
  await expect(page.getByTestId("stay-in-touch")).toBeVisible();
  await shot(page, "22-chat-archived");
  await page.getByTestId("stay-in-touch").click();
  await expect(page.getByTestId("squad-connect")).toBeVisible();
  await shot(page, "23-connect");

  expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
});
