import { expect, test } from "@playwright/test";
import { gotoReady, trackConsoleErrors, lockIn } from "./helpers";

test.setTimeout(210_000); // the scripted demo must finish in < 3.5 minutes

test("scripted demo flow end-to-end (simulated mode, ~20s queue)", async ({ page, request }) => {
  const t0 = Date.now();
  const errors = trackConsoleErrors(page);
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data")) external.push(r.url());
  });

  // 0. control panel: one-click reset, simulated mode, run from cache
  await gotoReady(page, "/demo");
  await page.getByTestId("demo-reset").click();
  await expect(page.getByTestId("demo-reset")).toHaveText(/Reset & reseed/);
  await page.getByTestId("mode-simulated").click();
  await request.post("/api/demo/settings", { data: { simFillMs: 18000, aiMode: "cache" } });
  await expect(page.getByTestId("join-url")).toContainText("/join");

  // 1. events feed
  await page.getByTestId("demo-start").click();
  await expect(page.getByTestId("events-page")).toBeVisible();
  // 2. open an event, Queue Up
  await page.getByTestId("event-card-ev-indie-guild").click();
  await page.getByTestId("queue-up-button").click();
  await page.getByTestId("size-6").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  // 3. queue visibly fills over ~20s
  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect(page.getByTestId("players-found")).toContainText("of 6");
  await expect.poll(async () => page.getByTestId("player-filled").count(), { timeout: 25_000 }).toBeGreaterThanOrEqual(3);
  // 4. squad forms; "How we matched you" opens in a sheet
  await lockIn(page, 40_000);
  await page.getByTestId("trace-toggle").click();
  await expect.poll(() => page.getByTestId("trace-step").count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(8);
  await page.keyboard.press("Escape");
  // 5. event confirmed + status card
  await page.getByTestId("view-event").click();
  await expect(page.getByTestId("squad-banner")).toBeVisible();
  // 6. Messages badge → squad chat with AI host welcome
  await page.getByTestId("tab-events").click();
  await expect(page.getByTestId("badge-chats")).toBeVisible();
  await page.getByTestId("open-chats").click();
  await page.locator('[data-testid^="inbox-row-"][data-type="squad"]').click();
  await expect(page.getByTestId("msg-host").first()).toContainText("Indie Night");
  await expect(page.getByTestId("msg-host").nth(1)).toContainText("Icebreaker");
  // 7. talk cards
  await page.getByTestId("open-talk-cards").click();
  await expect(page.locator('[data-testid^="talk-card-"]')).toHaveCount(5);
  await page.goBack();
  // 8. find each other: check in
  await page.getByTestId("open-find").click();
  await page.getByTestId("im-here").click();
  await expect(page.getByTestId("im-here")).toHaveText(/You're here/);
  // 9. presenter fast-forwards from /demo: the chat archives, add-friend prompt
  await request.post("/api/demo/fast-forward");
  await page.goBack();
  await expect(page.getByTestId("read-only")).toBeVisible();
  await page.getByTestId("stay-in-touch").click();
  await expect(page.getByTestId("squad-connect")).toBeVisible();
  const adds = page.locator('[data-testid^="add-"]'); // squadmates who were already friends show "Friends"
  await expect.poll(() => adds.count()).toBeGreaterThanOrEqual(3);
  const addIds = await adds.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!));
  for (const id of addIds) await page.getByTestId(id).click();
  await expect(page.getByTestId("see-new-friends")).toBeVisible({ timeout: 20_000 });
  // 10. Friends tab → Met through Queue Up
  await expect(page.getByTestId("badge-friends")).toBeVisible();
  await page.getByTestId("tab-friends").click();
  await page.getByTestId("friends-tab-queueup").click();
  await expect.poll(() => page.getByTestId("queueup-row").count(), { timeout: 15_000 }).toBe(addIds.length);
  await expect(page.getByTestId("met-at").first()).toContainText("Indie Night");

  expect(errors).toEqual([]);
  expect(external).toEqual([]); // nothing leaves the laptop: works offline
  expect(Date.now() - t0).toBeLessThan(210_000);
});
