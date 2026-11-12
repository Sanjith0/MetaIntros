import { expect, test } from "@playwright/test";
import { resetDemo, trackConsoleErrors, gotoReady, reloadReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("feed renders every event for each tab with correct filtering", async ({ page, request }) => {
  const errors = trackConsoleErrors(page);
  for (const tab of ["foryou", "nearby", "weekend"]) {
    const expected: { id: string }[] = await (await request.get(`/api/events?tab=${tab}`)).json();
    await gotoReady(page, `/events?tab=${tab}`);
    await expect(page.getByTestId(`feed-tab-${tab}`)).toHaveAttribute("aria-selected", "true");
    const cards = page.locator('[data-testid^="event-card-"]');
    await expect(cards).toHaveCount(expected.length);
    const ids = await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("event-card-", "")));
    expect(ids).toEqual(expected.map((e) => e.id));
  }
  const forYou: unknown[] = await (await request.get(`/api/events?tab=foryou`)).json();
  expect(forYou.length).toBeGreaterThanOrEqual(20);
  await page.getByTestId("queue-entry-open").click();
  await expect(page.getByTestId("queue-anything")).toBeVisible();
  expect(errors).toEqual([]);
});

test("detail page opens from a card, RSVP toggles, Queue Up button present", async ({ page }) => {
  await gotoReady(page, "/events");
  await page.getByTestId("event-card-ev-indie-guild").click();
  await expect(page.getByTestId("event-title")).toHaveText("Indie Night: Local Bands Showcase");
  await expect(page.getByTestId("rsvp")).toHaveAttribute("data-ready", "true");
  await Promise.all([page.waitForResponse((r) => r.url().includes("/rsvp")), page.getByTestId("rsvp-interested").click()]);
  await expect(page.getByTestId("rsvp-interested")).toHaveAttribute("aria-pressed", "true");
  await reloadReady(page);
  await expect(page.getByTestId("rsvp-interested")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("rsvp-going").click();
  await expect(page.getByTestId("rsvp-going")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rsvp-interested")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("queue-up-button")).toBeVisible();
});

test("private-venue events can't be queued for", async ({ page }) => {
  await gotoReady(page, "/events/ev-house-show");
  await expect(page.getByTestId("queue-up-private")).toBeVisible();
  await expect(page.getByTestId("queue-up-button")).toHaveCount(0);
});
