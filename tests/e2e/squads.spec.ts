import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resetDemo, gotoReady, lockIn, trackConsoleErrors } from "./helpers";

// Screenshots go to .screens/ (gitignored), like screens.spec.ts.
const DIR = process.env.SCREENS_DIR ?? ".screens";
async function shot(page: Page, name: string) {
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 5000 } });
});

async function queueNewHangout(page: Page) {
  await page.getByTestId("queue-entry-hangout").click(); // straight to setup: no mode list in between
  await expect(page.getByTestId("queue-sheet").getByTestId("queue-title")).toHaveText("Plan a new hangout");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("queue-kind")).toContainText("New hangout");
  await lockIn(page, 30_000);
  await expect(page.getByTestId("party-found")).toContainText("a new hangout");
}

test("Events: plan a new hangout in one tap, keep queuing while in a squad, see every squad, leave one", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await gotoReady(page, "/events");
  // one blue button ("Find a squad"); "Plan a new hangout" sits under it in grey
  await expect(page.getByTestId("queue-entry-open")).toBeVisible();
  await expect(page.getByTestId("queue-entry-hangout")).toBeVisible();
  await expect(page.getByTestId("my-squads")).toHaveCount(0);
  await shot(page, "50-events-plan-hangout");
  await queueNewHangout(page);

  // with a squad on, the status card keeps the primary action and queuing for another squad stays, in grey
  await gotoReady(page, "/events");
  await expect(page.getByTestId("squad-banner")).toHaveAttribute("data-status", /^(ready|venue)$/);
  await expect(page.getByTestId("queue-entry")).toContainText("Go with another squad");
  await expect(page.getByTestId("queue-entry-open")).toHaveText("Find another squad");
  await expect(page.getByTestId("my-squads")).toHaveCount(0); // the card covers the only squad
  await shot(page, "51-events-with-squad");

  // a second squad, for an event this time
  await page.getByTestId("queue-entry-open").click();
  await page.getByTestId("queue-anything").click();
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await lockIn(page, 30_000);

  await gotoReady(page, "/events");
  const rows = page.getByTestId("my-squads").locator('[data-testid^="my-squad-"]');
  await expect(rows).toHaveCount(2);
  await expect(page.getByTestId("my-squads")).toContainText("Your squads · 2");
  await expect(page.locator('[data-testid^="my-squad-"][data-hangout="true"]')).toHaveCount(1);
  await expect(page.getByTestId("squad-banner")).toHaveCount(0); // the list covers both squads; no squad shows twice
  await shot(page, "52-events-your-squads");

  // leave the hangout squad from Squad info
  const hangoutRow = page.locator('[data-testid^="my-squad-"][data-hangout="true"]');
  const partyId = (await hangoutRow.getAttribute("data-testid"))!.replace("my-squad-", "");
  await gotoReady(page, `/squad/${partyId}`);
  await page.getByTestId("leave-squad").scrollIntoViewIfNeeded();
  await shot(page, "53-squad-info-leave");
  await page.getByTestId("leave-squad").click();
  await expect(page.getByTestId("leave-squad-sheet")).toContainText("The others see that you left, not why.");
  await expect(page.getByTestId("leave-squad-confirm")).toBeInViewport();
  await page.waitForTimeout(400); // let the sheet finish sliding up
  await shot(page, "54-leave-squad-sheet");
  await page.getByTestId("leave-squad-confirm").click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByTestId("my-squads")).toHaveCount(0); // one squad left, and the card shows it
  await expect(page.getByTestId("squad-banner")).toBeVisible();

  // the squad you left is gone for you
  await gotoReady(page, `/squad/${partyId}`);
  await expect(page.getByTestId("not-found")).toBeVisible();
  expect((await page.request.post(`/api/squad/${partyId}/leave`)).status()).toBe(404);
  expect(errors).toEqual([]);
});
