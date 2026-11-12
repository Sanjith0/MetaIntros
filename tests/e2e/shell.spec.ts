import { expect, test } from "@playwright/test";
import { resetDemo, trackConsoleErrors, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("navigates every tab from the bottom bar", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await gotoReady(page, "/home");
  await expect(page.getByTestId("home-page")).toBeVisible();
  for (const tab of ["video", "friends", "events", "notifications", "profile", "home"]) {
    await page.getByTestId(`tab-${tab}`).click();
    await expect(page).toHaveURL(new RegExp(`/${tab}`));
    await expect(page.getByTestId(`${tab}-page`)).toBeVisible();
    await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("prototype-label")).toHaveText("Hackathon prototype, not Facebook");
  }
  // Chats live behind the top bar's Messages button, as in the template
  await page.getByTestId("open-chats").click();
  await expect(page.getByTestId("chats-page")).toBeVisible();
  await expect(page.getByTestId("me-avatar")).toBeVisible();
  expect(errors).toEqual([]);
});

test("badges appear for new activity and clear when the tab is opened", async ({ page }) => {
  await gotoReady(page, "/home");
  await expect(page.getByTestId("badge-chats")).toBeVisible();
  await expect(page.getByTestId("badge-friends")).toHaveText("1");

  await expect(page.getByTestId("badge-notifications")).toHaveText("4"); // the pending friend request + 3 friends queuing
  await page.getByTestId("open-chats").click();
  await expect(page.getByTestId("chats-page")).toBeVisible();
  await page.getByTestId("tab-notifications").click();
  await expect(page.getByTestId("notif-request")).toBeVisible();
  await expect(page.getByTestId("badge-notifications")).toHaveCount(0);
  await expect(page.getByTestId("badge-chats")).toHaveCount(0);
  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);

  // stays cleared after reload (persisted server-side)
  await gotoReady(page, "/home");
  await expect(page.getByTestId("tab-home")).toBeVisible();
  await expect(page.getByTestId("badge-chats")).toHaveCount(0);
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);
  await expect(page.getByTestId("badge-notifications")).toHaveCount(0);
});
