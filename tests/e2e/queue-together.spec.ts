import { expect, test, type Browser, type Page } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 3000 } });
});

async function liveUser(browser: Browser, name: string): Promise<Page> {
  const p = await (await browser.newContext()).newPage();
  await gotoReady(p, "/join");
  await p.getByTestId("join-name").fill(name);
  await p.getByTestId("join-age-18-24").click();
  await p.getByTestId("join-gender-none").click();
  await p.getByTestId("join-sample").click();
  await expect(p).toHaveURL(/\/events/);
  return p;
}

test("queue together by code: two phones, one squad (strangers fill the rest)", async ({ browser }) => {
  const host = await liveUser(browser, "Ana");
  const pal = await liveUser(browser, "Ben");

  await gotoReady(host, "/queue/start?mode=anything");
  await host.getByTestId("group-get-code").click();
  const code = (await host.getByTestId("group-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{4}$/);

  await gotoReady(pal, "/queue/start?mode=anything");
  await pal.getByTestId("group-code-input").fill(code);
  await pal.getByTestId("group-code-join").click();
  await expect(pal.getByTestId("group-member-card")).toContainText("You're queuing with Ana");
  await expect(pal.getByTestId("find-squad")).toHaveCount(0); // the host starts the queue

  await expect(host.getByTestId("group-member").filter({ hasText: "Ben" })).toBeVisible();
  await host.getByTestId("size-4").click();
  await expect(host.getByTestId("find-squad")).toContainText("Find a squad for 2 of you");
  await host.getByTestId("choose-area").click();
  await host.getByTestId("area-lm-downtown-pa").click();

  // the friend's phone follows into the queue on its own
  await expect(pal.getByTestId("queue-screen")).toBeVisible({ timeout: 10_000 });
  await expect(pal.getByTestId("queue-together-line")).toContainText("Ana");
  await expect(host.getByTestId("queue-together-line")).toContainText("Ben");

  for (const p of [host, pal]) await expect(p.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  const a = await (await host.request.get("/api/queue/status")).json();
  const b = await (await pal.request.get("/api/queue/status")).json();
  expect(a.partyId).toBe(b.partyId);
  await expect(host.getByTestId("party-members").locator("li")).toHaveCount(4);
});

test("invite a friend from queue setup: seeded friend accepts, group queues together", async ({ page }) => {
  await gotoReady(page, "/queue/start?mode=anything");
  await page.getByTestId("group-invite-friends").click();
  const first = page.getByTestId("group-invite-sheet").locator('[data-testid^="group-invite-p"]').first();
  await first.click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("group-member").filter({ hasText: "In your group" }).nth(1)).toBeVisible({ timeout: 8_000 });
  await page.getByTestId("size-5").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("queue-together-line")).toBeVisible();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
});
