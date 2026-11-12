import { expect, test } from "@playwright/test";
import { gotoReady, lockIn, resetDemo, trackConsoleErrors } from "./helpers";

const SHOTS = process.env.FRIENDS_SHOTS_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 5000 } });
});

/**
 * Jordan (p01) queues for Indie Night with two friends. The friends are sample people, so they say yes
 * on their own; a second phone (logged in as one friend) sees the invite first.
 */
test.setTimeout(120_000);
test("queue with friends: invite → friends say yes → start → one squad with both friends", async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4447, longitude: -122.1625 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  const errors = trackConsoleErrors(page);
  await gotoReady(page, "/events/ev-indie-guild");
  await page.getByTestId("queue-up-button").click();
  const sheet = page.getByTestId("queue-sheet");
  await sheet.getByTestId("size-5").click();
  await sheet.getByTestId("add-friends").click();
  await expect(sheet.getByTestId("friend-list")).toBeVisible();
  // a friend who's already queuing can't come, and says why; a 25+ friend can (all adults are one group)
  await expect(sheet.getByTestId("friend-p02")).toHaveAttribute("data-blocker", "busy");
  await expect(sheet.getByTestId("friend-p66")).not.toHaveAttribute("data-blocker", /.+/);
  await sheet.getByTestId("friend-p20").click();
  await sheet.getByTestId("friend-p30").click();
  await expect(sheet.getByTestId("add-friends")).toContainText("2 spots left for new people");
  await shot(page, "01-add-friends");
  await expect(sheet.getByTestId("find-squad")).toHaveText("Invite friends");
  await sheet.getByTestId("find-squad").click();

  await expect(page.getByTestId("waiting-for-friends")).toBeVisible();
  const groupUrl = page.url();

  // second phone: the friend who answers second still sees the invite
  const friend = await browser.newContext();
  await friend.request.post("/api/demo/login-as", { data: { userId: "p30" } });
  const fp = await friend.newPage();
  await gotoReady(fp, "/notifications");
  await expect(fp.getByTestId("notif-queue_invite")).toBeVisible();
  await fp.getByTestId("notif-queue_invite").click();
  await expect(fp.getByTestId("invite-heading")).toContainText("wants to find a squad with you");
  await shot(fp, "02-invite");

  // both friends are in (sample people answer on their own)
  await expect(page.getByTestId("seat-p20")).toHaveAttribute("data-status", "in", { timeout: 15_000 });
  await expect(page.getByTestId("seat-p30")).toHaveAttribute("data-status", "in", { timeout: 15_000 });
  await shot(page, "03-waiting-for-friends");
  await page.getByTestId("start-queuing").click();

  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect(page.getByTestId("player-friend")).toHaveCount(2);
  await expect(page.getByTestId("players-found")).toContainText("of 5");
  await shot(page, "04-queue");

  // newcomers must fit both friends (~30s), then Jordan taps "I'm in" (sample friends accept on their own)
  await lockIn(page, 60_000);
  await expect(page.getByTestId("party-members").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("came-with")).toHaveText(/^You, \w+ and \w+ \+ 2 new people$/);
  await page.waitForTimeout(1500); // members pop in staggered
  await shot(page, "05-squad-found");

  // the friend's phone followed along to the same squad
  await gotoReady(fp, "/queue");
  await expect(fp.getByTestId("party-found")).toBeVisible();

  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByText("came together", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await shot(page, "06-squad-chat");
  expect(errors).toEqual([]);
  await friend.close();
  await ctx.close();
  void groupUrl;
});

test("a smaller squad size keeps a spot open for someone new", async ({ page }) => {
  await gotoReady(page, "/queue/start?mode=anything");
  await page.getByTestId("size-4").click();
  await page.getByTestId("add-friends").click();
  await page.getByTestId("friend-p20").click();
  await page.getByTestId("friend-p30").click();
  // the squad is full: a third friend can't be added (one spot stays open for someone new)
  await expect(page.getByTestId("friend-p66")).toHaveAttribute("data-picked", "false");
  await page.getByTestId("friend-p66").click({ force: true });
  await expect(page.getByTestId("friend-p66")).toHaveAttribute("data-picked", "false");
  await expect(page.getByTestId("add-friends")).toContainText("1 spot left for new people");
});
