import { expect, test } from "@playwright/test";

// The demo path. When this passes, the MVP is "done" (see docs/PRD.md §9).
test("Maya goes from an event page to meeting her crew", async ({ page, request }) => {
  await request.post("/api/reset");

  // 1. Event page with the Crews entry point
  await page.goto("/");
  await page.getByTestId("feed-event").click();
  await expect(page.getByTestId("crew-entry")).toContainText("Going solo? Join a crew.");
  await page.getByTestId("join-crew").click();

  // 2. Queue settings: taste profile + safety filter
  await expect(page.getByText("Your taste profile")).toBeVisible();
  await page.getByTestId("women-only").check();
  await page.getByTestId("find-crew").click();

  // 3. Queue → demo fill → agent forms the crew live
  await expect(page.getByTestId("queue-timer")).toBeVisible();
  await page.getByTestId("demo-fill").click();
  const steps = page.getByTestId("agent-steps");
  await expect(steps).toContainText("Applied safety filters", { timeout: 30_000 });
  await expect(steps).toContainText("Swapped", { timeout: 30_000 });
  await expect(steps).toContainText("Meetup:", { timeout: 30_000 });
  await expect(page.getByTestId("crew-found")).toBeVisible();
  await page.getByTestId("view-crew").click();

  // 4. Crew page: mutual reveal after everyone accepts
  await expect(page.getByTestId("meetup")).toBeVisible();
  await page.getByTestId("accept-crew").click();
  await expect(page.getByTestId("revealed")).toBeVisible();
  await expect(page.getByTestId("accept-count")).toHaveText("6/6 in");

  // 5. Crew chat opens with the assistant's plan
  await page.getByTestId("open-chat").click();
  await expect(page.getByTestId("assistant-msg").first()).toBeVisible();
  await page.getByTestId("chat-input").fill("hi everyone!! so excited");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("chat")).toContainText("hi everyone!! so excited");
  await page.getByRole("link", { name: "Back" }).click();

  // 6. Icebreaker card for Priya, grounded in shared data
  await page.getByTestId("open-icebreakers").click();
  await page.getByTestId("card-priya").click();
  await expect(page.getByTestId("icebreaker-card")).toContainText("Priya Raman");
  await expect(page.getByTestId("icebreaker-card")).toContainText("Cal Hacks 11");
  await expect(page.getByTestId("opener")).toBeVisible();

  // 7. Meetup check-in
  await page.goto(page.url().replace(/\/people\/priya$/, "/live"));
  await page.getByTestId("im-here").click();
  await expect(page.getByTestId("arrived-count")).toHaveText("6 of 6 here");
});
