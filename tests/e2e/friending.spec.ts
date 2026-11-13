import { expect, test } from "@playwright/test";
import { gotoReady, resetDemo, lockIn } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("after the event: add squadmates → simulated members accept → Met through Link", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await lockIn(page, 30_000);
  await page.getByTestId("open-squad-chat").click();
  await expect(page.getByTestId("composer")).toBeVisible();
  await page.request.post("/api/demo/fast-forward");
  await page.getByTestId("rate-skip").click(); // the post-event rating pop-up opens first
  await page.getByTestId("stay-in-touch").click();

  await expect(page.getByTestId("squad-connect")).toBeVisible();
  const adds = page.locator('[data-testid^="add-"]');
  await expect(adds).toHaveCount(3);
  const ids = await adds.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("add-", "")));
  for (const id of ids) await page.getByTestId(`add-${id}`).click();
  for (const id of ids) await expect(page.getByTestId(`connect-${id}`)).toHaveAttribute("data-state", /requested|friends/);
  // simulated squadmates accept after a short delay
  for (const id of ids) await expect(page.getByTestId(`connect-${id}`)).toHaveAttribute("data-state", "friends", { timeout: 15_000 });

  await expect(page.getByTestId("badge-friends")).toBeVisible();
  await page.getByTestId("see-new-friends").click();
  await expect(page.getByTestId("queueup-row")).toHaveCount(3);
  await expect(page.getByTestId("met-at").first()).toHaveText("Met through Link · Indie Night: Local Bands Showcase");
  await expect(page.getByTestId("shared-note").first()).toContainText("You both love");
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);
});
