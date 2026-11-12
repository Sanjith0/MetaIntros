import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("talk cards render for every party member, reachable from header + avatars", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-5").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("open-squad-chat").click();
  await page.getByTestId("open-talk-cards").click();

  await expect(page.getByTestId("talk-cards")).toBeVisible();
  const cards = page.locator('[data-testid^="talk-card-"]');
  await expect(cards).toHaveCount(4); // everyone except me
  for (let i = 0; i < 4; i++) {
    const c = cards.nth(i);
    await expect(c.getByTestId("claim").first()).toBeAttached();
    await expect(c.getByTestId("claim-source").first()).toBeAttached();
    expect(await c.getByTestId("card-openers").locator("li").count()).toBeGreaterThanOrEqual(2);
  }
  await expect(page.getByTestId("card-position")).toHaveText("1 of 4");

  // deep link from a member avatar opens that member's card
  await page.goBack();
  const avatar = page.locator('[data-testid^="member-avatar-"]').nth(2);
  const id = (await avatar.getAttribute("data-testid"))!.replace("member-avatar-", "");
  await avatar.click();
  await expect(page.getByTestId(`talk-card-${id}`)).toBeInViewport();
});
