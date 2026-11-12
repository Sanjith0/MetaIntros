import { expect, test } from "@playwright/test";
import { resetDemo, trackConsoleErrors } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("navigates every tab from the bottom bar", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/home");
  await expect(page.getByTestId("home-page")).toBeVisible();
  for (const tab of ["events", "friends", "chats", "profile", "home"]) {
    await page.getByTestId(`tab-${tab}`).click();
    await expect(page).toHaveURL(new RegExp(`/${tab}`));
    await expect(page.getByTestId(`${tab}-page`)).toBeVisible();
    await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute("aria-current", "page");
  }
  await expect(page.getByTestId("header-avatar")).toBeVisible();
  expect(errors).toEqual([]);
});

test("badges appear for new activity and clear when the tab is opened", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByTestId("badge-chats")).toBeVisible();
  await expect(page.getByTestId("badge-friends")).toHaveText("1");

  await page.getByTestId("tab-chats").click();
  await expect(page.getByTestId("badge-chats")).toHaveCount(0);
  await page.getByTestId("tab-friends").click();
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);

  // stays cleared after reload (persisted server-side)
  await page.goto("/home");
  await expect(page.getByTestId("tab-home")).toBeVisible();
  await expect(page.getByTestId("badge-chats")).toHaveCount(0);
  await expect(page.getByTestId("badge-friends")).toHaveCount(0);
});
