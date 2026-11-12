import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/* M1 proof: screenshots of each Facebook-layer route under shots/. */

async function as(context: BrowserContext, baseURL: string, id: string) {
  await context.addCookies([{ name: "pq_viewer", value: id, url: baseURL }]);
}

/** The live connection opens only after hydration, so this also waits for React. */
async function ready(page: Page) {
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
}

test.beforeEach(async ({ request }) => {
  await request.post("/api/demo/reset");
});

test("events tab", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, "maya");
  await page.goto("/events");
  await expect(page.getByTestId("event-card-evt-rooftop")).toBeVisible();
  await expect(page.getByTestId("prototype-label")).toHaveText(/Hackathon prototype, not Facebook/i);
  await page.screenshot({ path: "shots/m1-events.png", animations: "disabled" });
});

test("event page with Interested, Going, guest list and Find my party", async ({ page, context, baseURL, request }) => {
  // A few people the viewer can see are going.
  for (const id of ["priya", "sam", "theo"]) {
    const ctx = await request.post("/api/viewer", { data: { id } });
    expect(ctx.ok()).toBeTruthy();
    await request.post("/api/rsvp", { data: { eventId: "evt-rooftop", status: "going" }, headers: { cookie: `pq_viewer=${id}` } });
  }
  await as(context, baseURL!, "maya");
  await page.goto("/event/evt-rooftop");
  await ready(page);
  await expect(page.getByTestId("find-my-party")).toBeVisible();
  await page.screenshot({ path: "shots/m1-event.png", animations: "disabled" });

  await page.getByTestId("rsvp-interested").click();
  await expect(page.getByTestId("rsvp-interested")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("rsvp-going").click();
  await expect(page.getByTestId("rsvp-going")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("rsvp-interested")).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: "shots/m1-event-going.png", animations: "disabled" });

  await page.getByTestId("going-count").click();
  await expect(page.getByRole("dialog", { name: "Guest list" })).toBeVisible();
  await page.screenshot({ path: "shots/m1-guest-list.png", animations: "disabled" });
});

test("messenger-style group chat", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, "maya");
  await page.goto("/chat/chat-portuguese");
  await ready(page);
  await expect(page.getByTestId("pinned-banner")).toBeVisible();
  await page.getByTestId("composer").fill("I'll bring snacks!");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("message").last()).toContainText("I'll bring snacks!");
  await page.screenshot({ path: "shots/m1-chat.png", animations: "disabled" });
});

test("notification toast arrives live", async ({ page, context, baseURL, request }) => {
  await as(context, baseURL!, "maya");
  await page.goto("/events");
  await ready(page);
  await request.post("/api/chat/chat-portuguese/messages", { data: { text: "Snacks would be amazing, thank you!" }, headers: { cookie: "pq_viewer=zoe" } });
  await expect(page.getByTestId("toast")).toContainText("Snacks would be amazing");
  await page.screenshot({ path: "shots/m1-toast.png", animations: "disabled" });
});

test("demo user switcher", async ({ page, context, baseURL }) => {
  await as(context, baseURL!, "maya");
  await page.goto("/events");
  await ready(page);
  await page.getByTestId("user-switcher").click();
  await expect(page.getByTestId("switch-dev")).toBeVisible();
  await page.screenshot({ path: "shots/m1-switcher.png", animations: "disabled" });
  await page.getByTestId("switch-dev").click();
  await expect(page.locator("[data-viewer=dev]")).toHaveCount(1);
});
