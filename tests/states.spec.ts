import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F17: empty, error and not-found states; keyboard paths. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("not found: a broken event link gets a page in the shell, with a way back", async ({ page }) => {
  const res = await page.goto("/event/no-such-event");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toContainText("This page isn't available");
  await page.getByRole("link", { name: "Go to Events" }).click();
  await expect(page).toHaveURL(/\/events$/);
  await page.goto("/event/no-such-event");
  await page.screenshot({ path: "shots/f17-not-found.png", animations: "disabled" });
});

test("keyboard: skip link, user switcher closes on Escape, MATCH FOUND takes focus and Escape closes it", async ({ page, context, baseURL, request }) => {
  await request.post("/api/demo/reset");
  await request.post("/api/demo/start", { data: { mode: "four" } });
  await context.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  await page.goto("/events");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  await page.keyboard.press("Tab");
  await expect(page.getByTestId("skip-link")).toBeFocused();
  await page.screenshot({ path: "shots/f17-skip-link.png", animations: "disabled" });
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  await page.getByTestId("user-switcher").click();
  await expect(page.getByTestId("user-switcher")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("user-switcher")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("user-switcher").click();
  await page.mouse.click(640, 600);
  await expect(page.getByTestId("user-switcher")).toHaveAttribute("aria-expanded", "false");

  await request.post("/api/queue/join", {
    data: { eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences.maya, consentBridges: true },
    headers: { cookie: "pq_viewer=maya" },
  });
  const dialog = page.getByRole("dialog", { name: "Match found" });
  await expect(dialog).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("link", { name: "Open group chat" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("chat: a message that fails to send can be tried again", async ({ browser, baseURL, request }) => {
  await request.post("/api/demo/reset");
  const ctx = await browser.newContext(PHONE);
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/chat/chat-portuguese");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.route("**/api/chat/*/messages", (r) => r.fulfill({ status: 500, body: "{}" }));
  await page.getByTestId("composer").fill("See you Thursday");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("send-failed")).toContainText("Not sent.");
  await page.screenshot({ path: "shots/f17-send-failed.png", animations: "disabled" });
  await page.unroute("**/api/chat/*/messages");
  await page.getByTestId("send-retry").tap();
  await expect(page.getByTestId("composer")).toHaveValue("See you Thursday");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("message").last()).toContainText("See you Thursday");
  await expect(page.getByTestId("send-failed")).toHaveCount(0);
  await ctx.close();
});
