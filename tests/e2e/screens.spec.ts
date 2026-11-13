import { expect, test, type Page } from "@playwright/test";
import { gotoReady, resetDemo, trackConsoleErrors, lockIn } from "./helpers";

test.setTimeout(180_000);

const DIR = process.env.SCREENS_DIR ?? "docs/screens";

async function shot(page: Page, name: string) {
  await page.waitForTimeout(450); // let entrance animations settle
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name} has horizontal scroll`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

test("iPhone screenshots of every screen, no console errors, no horizontal scroll", async ({ page, request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 6000 } });
  const errors = trackConsoleErrors(page);

  for (const [url, name] of [
    ["/home", "01-home"], ["/events", "02-events-for-you"], ["/events?tab=nearby", "03-events-local"],
    ["/events?tab=weekend", "04-events-weekend"], ["/events/ev-indie-guild", "05-event-detail"],
    ["/events/ev-house-show", "06-event-private"], ["/chats", "07-chats"], ["/friends", "08-friends"],
    ["/friends?tab=requests", "09-friend-requests"], ["/friends?tab=queueup", "10-met-through-empty"],
    ["/profile", "11-profile"], ["/join", "12-join"], ["/demo", "13-demo-panel"], ["/nope", "14-not-found"],
    ["/notifications", "15-notifications"], ["/video", "16-video"],
  ] as const) {
    await gotoReady(page, url);
    await shot(page, name);
  }

  // The hero path, in demo order.
  await gotoReady(page, "/events");
  await page.getByTestId("queue-entry-open").click();
  await shot(page, "17-queue-sheet");
  await page.keyboard.press("Escape");
  await gotoReady(page, "/events/ev-indie-guild");
  await page.getByTestId("queue-up-button").click();
  await shot(page, "18-setup-sheet");
  await page.getByTestId("choose-area").click();
  await shot(page, "19-area-picker");
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect.poll(() => page.getByTestId("player-filled").count(), { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  await shot(page, "20-queue-filling");
  await expect(page.getByTestId("ready-check")).toBeVisible({ timeout: 30_000 });
  await shot(page, "20b-ready-check");
  await lockIn(page);
  await page.waitForTimeout(900);
  await shot(page, "21-squad-found");
  await page.getByTestId("trace-toggle").click();
  await expect.poll(() => page.getByTestId("trace-step").count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(8);
  await shot(page, "22-how-we-matched");
  await page.keyboard.press("Escape");
  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByTestId("msg-host").first()).toBeVisible();
  await shot(page, "23-squad-chat");
  await page.getByTestId("squad-info").click();
  await expect(page.getByTestId("squad-info-page")).toBeVisible();
  await shot(page, "24-squad-info");
  await page.getByTestId("open-talk-cards").click();
  await expect(page.locator('[data-testid^="talk-card-"]').first()).toBeVisible();
  await shot(page, "25-talk-cards");
  await page.goBack();
  await page.getByTestId("open-find").click();
  await page.getByTestId("im-here").click();
  await expect(page.getByTestId("im-here")).toHaveText(/You're here/);
  await shot(page, "26-find-each-other");
  await gotoReady(page, "/events");
  await shot(page, "27-events-status-card");
  await request.post("/api/demo/fast-forward");
  await page.goBack();
  await page.goBack();
  await gotoReady(page, "/chats");
  await page.locator('[data-testid^="inbox-row-"][data-type="squad"]').click();
  await expect(page.getByTestId("rate-sheet")).toBeVisible();
  await shot(page, "28-rate-squad");
  await page.getByTestId("rate-skip").click();
  await expect(page.getByTestId("stay-in-touch")).toBeVisible();
  await shot(page, "28-chat-ended");
  await page.getByTestId("stay-in-touch").click();
  await expect(page.getByTestId("squad-connect")).toBeVisible();
  await shot(page, "29-connect");
  await page.getByTestId("connect-share").click();
  await expect(page.getByTestId("share-outing")).toBeVisible();
  await shot(page, "30-share-outing");
  await page.getByTestId("share-own").click();
  await expect(page.getByTestId("post-composer")).toBeVisible();
  await shot(page, "31-share-compose");
  await page.getByTestId("composer-cancel").click();
  await page.getByTestId("back").click();
  await expect(page.getByTestId("squad-info-page")).toBeVisible();
  await page.getByTestId("open-album").click();
  await expect(page.getByTestId("squad-album")).toBeVisible();
  await shot(page, "32-squad-album");

  expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
});
