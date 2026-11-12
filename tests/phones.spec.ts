import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F3: five phones join by QR link, all five show MATCH FOUND within a second, with sound and a buzz. */

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const IDS = ["maya", "dev", "ana", "kai", "zoe"] as const;

test("real phones: QR join, all five live, MATCH FOUND within a second", async ({ browser, page, request }) => {
  test.setTimeout(180_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/phones");
  await expect(page.getByTestId("phones-grid").locator("svg")).toHaveCount(5);
  await expect(page.getByTestId("phones-live")).toHaveText("0 of 5 phones live");

  // Each phone opens its own QR link (the same path the code encodes).
  const phones: Record<string, { ctx: BrowserContext; page: Page }> = {};
  for (const id of IDS) {
    const href = await page.getByTestId(`phone-link-${id}`).getAttribute("href");
    expect(href).toBe(`/join/${id}`);
    const ctx = await browser.newContext(PHONE);
    const p = await ctx.newPage();
    await p.goto(href!);
    await expect(p.locator(`[data-viewer=${id}]`)).toHaveCount(1);
    await expect(p.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await p.locator("body").tap({ position: { x: 5, y: 300 } }); // the first tap unlocks sound
    phones[id] = { ctx, page: p };
  }
  await expect(page.getByTestId("phones-live")).toHaveText("5 of 5 phones live");
  await expect(phones.maya!.page).toHaveURL(new RegExp(`/event/${DEMO_PARTY.entryEventId}$`));

  // Operator queues the other four; Maya types on her phone.
  await page.getByTestId("phones-queue-four").click();
  await expect(phones.maya!.page.locator("[data-live=on]")).toHaveCount(1);
  await phones.maya!.page.getByTestId("find-my-party").tap();
  await phones.maya!.page.getByTestId("sentence").fill(DEMO_PARTY.sentences.maya!);
  await expect(phones.maya!.page.getByTestId("brief-preview")).toBeVisible();
  await phones.maya!.page.getByTestId("join-queue").tap();

  for (const id of IDS) {
    const m = phones[id]!.page.getByTestId("match-found");
    await expect(m).toBeVisible({ timeout: 90_000 });
    await expect(m).toHaveAttribute("data-sound", "played");
    await expect(m).toHaveAttribute("data-vibrate", /yes|unsupported/);
  }

  // Every phone reported back; the slowest is under a second.
  await expect(page.getByTestId("phones-result")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("phones-result")).toContainText("5 of 5 showed MATCH FOUND");
  const slowest = Number(await page.getByTestId("phones-result").getAttribute("data-slowest"));
  console.log(`slowest phone showed MATCH FOUND ${slowest} ms after the lock`);
  expect(slowest).toBeLessThanOrEqual(1000);
  for (const id of IDS) await expect(page.getByTestId(`phone-lag-${id}`)).toContainText("MATCH FOUND +");
  await page.screenshot({ path: "shots/f3-phones.png", animations: "disabled" });
  await phones.dev!.page.screenshot({ path: "shots/f3-phone-dev.png", animations: "disabled" });

  await Promise.all(Object.values(phones).map((p) => p.ctx.close()));
});
