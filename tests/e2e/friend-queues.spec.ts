import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady, lockIn } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 5000 } });
});

test("friends' queues: home card → Events row → sheet → Queue up too", async ({ page }) => {
  await gotoReady(page, "/home");
  await expect(page.getByTestId("home-friend-queues")).toContainText("3 friends are queuing this weekend");
  await page.getByTestId("home-friend-queues").click();

  await expect(page.getByTestId("friend-queues")).toBeVisible();
  const row = page.getByTestId("friend-queues").getByTestId("friend-queue");
  await expect(row).toHaveCount(3);
  await expect(page.locator('[data-testid="friend-queue"][data-friend="p50"]')).toHaveCount(0); // Oscar queues privately

  await page.locator('[data-testid="friend-queue"][data-friend="p04"]').click();
  const sheet = page.getByTestId("friend-queue-sheet");
  await expect(sheet).toContainText("Reza is queuing");
  await expect(sheet).toContainText("Queuing for Indie Night");
  await expect(sheet).toContainText("Near Menlo Park Caltrain");
  await expect(sheet.getByTestId("friend-queue-why")).toContainText("Reza");
  await expect(sheet.getByTestId("friend-queue-why-source")).toBeVisible(); // AI line always says where it came from
  await sheet.getByTestId("queue-up-too").click();
  await expect(page.getByTestId("queue-screen")).toBeVisible();
});

test("event page lists friends in that queue; Friends tab shows status; sharing is off by default", async ({ page }) => {
  await gotoReady(page, "/events/ev-photo-walk");
  await expect(page.getByTestId("friend-queues-event")).toContainText("Freya Rossi");
  await expect(page.getByTestId("friends-in-line")).toContainText("1 friend is in line for this");

  await gotoReady(page, "/friends");
  await expect(page.getByTestId("friend-queue-status").first()).toBeVisible();

  await gotoReady(page, "/profile");
  await expect(page.getByTestId("profile-queue-visibility-toggle")).not.toBeChecked();

  await gotoReady(page, "/events/ev-indie-guild");
  await page.getByTestId("queue-up-button").click();
  await expect(page.getByTestId("share-with-friends-toggle")).not.toBeChecked();
});

test("join a friend's queue: see their status, Join → same group, land in their squad", async ({ page }) => {
  await gotoReady(page, "/events");
  await page.locator('[data-testid="friend-queue"][data-friend="p04"]').first().click();
  const sheet = page.getByTestId("friend-queue-sheet");
  await expect(sheet.getByTestId("friend-queue-progress")).toContainText(/of 5 found|Looking for matches/);
  await expect(sheet.getByTestId("join-together-note")).toContainText("same squad");
  await expect(sheet.getByTestId("queue-up-too")).toContainText("Queue separately"); // still offered
  await sheet.getByTestId("join-friend-squad").click();
  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect(page.getByTestId("queue-together-line")).toContainText("Reza");
  await lockIn(page); // Reza is a seeded friend, so only Jordan taps "I'm in"
  await expect(page.getByTestId("party-members")).toContainText("Reza");
});
