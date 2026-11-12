import { expect, test } from "@playwright/test";
import { gotoReady, resetDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("after the event: add squadmates → simulated members accept → Met through Queue Up", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-3").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("open-squad-chat").click();
  await page.getByTestId("fast-forward").click();
  await page.getByTestId("stay-in-touch").click();

  await expect(page.getByTestId("squad-connect")).toBeVisible();
  const adds = page.locator('[data-testid^="add-"]');
  await expect(adds).toHaveCount(2);
  const ids = await adds.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("add-", "")));
  for (const id of ids) await page.getByTestId(`add-${id}`).click();
  for (const id of ids) await expect(page.getByTestId(`connect-${id}`)).toHaveAttribute("data-state", /requested|friends/);
  // simulated squadmates accept after a short delay
  for (const id of ids) await expect(page.getByTestId(`connect-${id}`)).toHaveAttribute("data-state", "friends", { timeout: 15_000 });

  await expect(page.getByTestId("badge-friends")).toBeVisible();
  await page.getByTestId("see-new-friends").click();
  await expect(page.getByTestId("queueup-row")).toHaveCount(2);
  await expect(page.getByTestId("met-at").first()).toHaveText("Met at Indie Night: Local Bands Showcase");
  await expect(page.getByTestId("shared-note").first()).toContainText("You both love");
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);
});
