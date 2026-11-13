import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lockIn, resetDemo } from "./helpers";

/** Set SHOTS_DIR to save screenshots of each step (for the PR). */
const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

async function squadUpAndEnd(page: Page) {
  await gotoReady(page, "/queue/start?eventId=ev-boulder-social");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-rwc-courthouse").click();
  await lockIn(page, 30_000);
  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByTestId("composer")).toBeVisible();
  await page.request.post("/api/demo/fast-forward"); // the open chat ends live
}

test("the chat ends → the rating pop-up opens; ratings save privately and tune For you and the next squad", async ({ page }) => {
  await squadUpAndEnd(page);
  const sheet = page.getByTestId("rate-sheet");
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await expect(sheet).toContainText("How was the night?");
  await expect(page.getByTestId("rate-privacy")).toContainText("Nobody is told how you rated them");
  await expect(page.getByTestId("rate-submit")).toBeDisabled();
  await shot(page, "01-popup");

  await page.getByTestId("rate-star-5").click();
  await expect(page.getByTestId("rate-star-word")).toHaveText("Loved it");
  const rows = sheet.locator('[data-testid^="rate-mate-"]');
  await expect(rows).toHaveCount(3);
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("rate-mate-", "")));
  await page.getByTestId(`rate-again-${ids[0]}`).click();
  await page.getByTestId(`rate-again-${ids[1]}`).click();
  await page.getByTestId(`rate-not-again-${ids[2]}`).click();
  await expect(page.getByTestId(`rate-mate-${ids[2]}`)).toHaveAttribute("data-verdict", "not_again");
  await shot(page, "02-filled");

  await page.getByTestId("rate-submit").click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("rated-line")).toContainText("You rated this night 5 of 5");
  await shot(page, "03-after");

  // reload: the pop-up doesn't come back; Edit reopens it with your answers
  await page.reload();
  await expect(page.getByTestId("rated-line")).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await page.getByTestId("rate-edit").click();
  await expect(page.getByTestId(`rate-mate-${ids[0]}`)).toHaveAttribute("data-verdict", "again");
  await page.keyboard.press("Escape");

  // For you: nights like the one you loved say so
  await gotoReady(page, "/events?tab=foryou");
  await expect(page.getByTestId("rated-reason").first()).toBeVisible();
  await page.getByTestId("rated-reason").first().scrollIntoViewIfNeeded();
  await shot(page, "04-for-you");

  // Next squad: never the person you said no to; the trace says ratings were used, with no names
  await page.getByTestId("queue-entry-open").click();
  await page.getByTestId("queue-hangout").click();
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-rwc-courthouse").click();
  await lockIn(page, 30_000);
  await page.getByTestId("trace-toggle").click();
  const step = page.getByTestId("trace-sheet").getByText("Used past squad ratings");
  await expect(step).toBeVisible();
  await step.scrollIntoViewIfNeeded();
  await shot(page, "05-trace");
});

test("Not now closes the pop-up for good; Rate your squad stays in the chat", async ({ page }) => {
  await squadUpAndEnd(page);
  await expect(page.getByTestId("rate-sheet")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("rate-skip").click();
  await expect(page.getByTestId("rate-sheet")).toHaveCount(0);
  await expect(page.getByTestId("rate-open")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("rate-open")).toBeVisible();
  await expect(page.getByTestId("rate-sheet")).toHaveCount(0);
  await page.getByTestId("rate-open").click();
  await expect(page.getByTestId("rate-sheet")).toBeVisible();
});
