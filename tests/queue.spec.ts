import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

test.beforeEach(async ({ request }) => {
  await request.post("/api/demo/reset");
});

test("queue sheet: sentence, private preview, live timer", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  await page.goto(`/event/${DEMO_PARTY.entryEventId}`);
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("find-my-party").click();
  await expect(page.getByTestId("queue-sheet")).toBeVisible();
  await page.getByTestId("sentence").fill(DEMO_PARTY.sentences.maya!);
  await expect(page.getByTestId("brief-preview")).toContainText("No drink minimum");
  await expect(page.getByTestId("brief-preview")).toContainText("Done by 11 PM");
  await expect(page.getByTestId("brief-preview")).toContainText("$20 or less");
  await page.screenshot({ path: "shots/m2-queue-preview.png", animations: "disabled" });
  await page.getByTestId("join-queue").click();
  await expect(page.getByTestId("queue-timer")).toBeVisible();
  const t0 = await page.getByTestId("queue-timer").textContent();
  await page.waitForTimeout(1600);
  const t1 = await page.getByTestId("queue-timer").textContent();
  expect(t1).not.toEqual(t0);
  await expect(page.getByTestId("queue-count")).toContainText("1 of 5");
  await page.screenshot({ path: "shots/m2-queue-waiting.png", animations: "disabled" });
});
