import { expect, test } from "@playwright/test";

// Every screen renders without a client-side exception.
const pages = ["/", "/events", "/events/pale-hour", "/events/pale-hour/crew", "/menu", "/notifications", "/crews", "/glasses", "/video", "/friends"];

for (const path of pages) {
  test(`renders ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("Application error");
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
}

test("home feed links to the event, tab bar navigates", async ({ page, request }) => {
  await request.post("/api/reset");
  await page.goto("/");
  await page.getByTestId("feed-event").click();
  await expect(page).toHaveURL(/\/events\/pale-hour$/);
  await expect(page.getByTestId("crew-entry")).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Events" }).last().click();
  await expect(page).toHaveURL(/\/events$/);
});

test("menu reset clears crews", async ({ page }) => {
  await page.goto("/menu");
  await page.getByTestId("reset-demo").click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/crews");
  await expect(page.getByText("No crews yet")).toBeVisible();
});
