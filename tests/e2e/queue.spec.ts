import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 5000 } });
});

test("join from an event page (GPS) → queue fills → party found → squad banner on event", async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 37.4447, longitude: -122.1625 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  await gotoReady(page, "/events/ev-indie-guild");
  await page.getByTestId("queue-up-button").click();
  await expect(page.getByTestId("queue-setup")).toBeVisible();
  await page.getByTestId("size-5").click();
  await expect(page.getByTestId("size-5")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("find-squad").click();

  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect(page.getByTestId("players-found")).toContainText("/5");
  await expect(page.getByTestId("player-slots").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("party-members").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("party-event")).toContainText("Indie Night");
  // agent trace streams in step by step
  await expect(page.getByTestId("trace-panel")).toBeVisible();
  await expect(page.getByTestId("trace-step").first()).toBeVisible();
  await expect.poll(() => page.getByTestId("trace-step").count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(7);
  await expect(page.locator('[data-testid="trace-step"][data-kind="safety_check"]').first()).toBeVisible();
  await page.getByTestId("trace-toggle").click();
  await expect(page.getByTestId("trace-steps")).toHaveCount(0);

  // squad chat lands in the inbox with a badge
  await expect(page.getByTestId("badge-chats")).toBeVisible();
  await page.getByTestId("tab-chats").click();
  const top = page.locator('[data-testid^="inbox-row-"]').first();
  await expect(top).toHaveAttribute("data-type", "squad");
  await expect(top.getByTestId("squad-badge")).toBeVisible();
  await expect(top.getByTestId("squad-event")).toContainText("Indie Night");
  await expect(top.getByTestId("squad-expiry")).toContainText("Expires in");
  await top.click();
  await expect(page.getByTestId("squad-header-event")).toContainText("Indie Night");
  await expect(page.getByTestId("squad-header-spot")).toContainText("The Guild Theatre");
  await expect(page.getByTestId("squad-header-time")).toBeVisible();
  await expect(page.getByTestId("squad-header-members").locator("li")).toHaveCount(5);
  await page.goBack();
  await page.goBack();
  await page.getByTestId("view-event").click();
  await expect(page.getByTestId("squad-banner")).toBeVisible();
  await expect(page.getByTestId("squad-banner")).toContainText("Your squad is going");
  await gotoReady(page, "/events");
  await expect(page.getByTestId("event-card-ev-indie-guild")).toContainText("Your squad is going");
  await ctx.close();
});

test("location denied → manual area picker → queue", async ({ page }) => {
  await gotoReady(page, "/queue/start?mode=anything");
  await page.getByTestId("find-squad").click();
  await expect(page.getByTestId("area-picker")).toBeVisible();
  await page.getByTestId("area-lm-stanford-oval").click();
  await expect(page.getByTestId("queue-screen")).toBeVisible();
  await expect(page.getByTestId("queue-screen")).toContainText("Stanford Oval");
  await page.getByTestId("leave-queue").click();
  await expect(page).toHaveURL(/\/events/);
});

test("live mode: three real people pick size 3 and land in the same party", async ({ browser, request }) => {
  await request.post("/api/demo/settings", { data: { fillMode: "live" } });
  const pages = [];
  for (const name of ["Ana Live", "Ben Live", "Cy Live"]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await gotoReady(p, "/join");
    await p.getByTestId("join-name").fill(name);
    await p.getByTestId("join-age-18-24").click();
    await p.getByTestId("join-gender-none").click();
    await p.getByTestId("join-sample").click();
    await expect(p).toHaveURL(/\/events/);
    await gotoReady(p, "/queue/start?mode=anything");
    await p.getByTestId("size-3").click();
    await p.getByTestId("choose-area").click();
    await p.getByTestId("area-lm-downtown-pa").click();
    await expect(p.getByTestId("queue-screen")).toBeVisible();
    pages.push(p);
  }
  for (const p of pages) await expect(p.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  const ids = [];
  for (const p of pages) {
    const s = await (await p.request.get("/api/queue/status")).json();
    ids.push(s.partyId);
    await expect(p.getByTestId("party-members").locator("li")).toHaveCount(3);
  }
  expect(new Set(ids).size).toBe(1);
});
