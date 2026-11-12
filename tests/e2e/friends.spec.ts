import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("friends tabs render seeded data; Queue Up tab starts empty", async ({ page }) => {
  await gotoReady(page, "/friends");
  await expect(page.getByTestId("friends-tab-friends")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("friend-row")).toHaveCount(8);

  await page.getByTestId("friends-tab-requests").click();
  await expect(page.getByTestId("request-row")).toHaveCount(1);

  await page.getByTestId("friends-tab-queueup").click();
  await expect(page.getByTestId("queueup-empty")).toBeVisible();
});

test("confirming a request adds a friend", async ({ page }) => {
  await gotoReady(page, "/friends?tab=requests");
  await page.getByTestId("request-confirm").click();
  await expect(page.getByText("No pending requests")).toBeVisible();
  await page.getByTestId("friends-tab-friends").click();
  await expect(page.getByTestId("friend-row")).toHaveCount(9);
});
