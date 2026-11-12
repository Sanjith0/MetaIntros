import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500, aiMode: "cache" } });
});

test("AI output says where it came from, in plain words, and offline runs never claim live AI", async ({ page, request }) => {
  const status = await (await request.get("/api/ai/status")).json();
  expect(status.mode).toBe("cache");
  expect(status.state).not.toBe("live");

  // no status badge in the top bar (SYNTHESIS #16)
  await gotoReady(page, "/home");
  await expect(page.getByTestId("ai-status")).toHaveCount(0);

  await gotoReady(page, "/events/ev-indie-guild");
  await page.getByTestId("queue-up-button").click();
  await page.getByTestId("size-5").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });

  // "How we matched you": AI lines carry their source; the status sits in a footnote
  await page.getByTestId("trace-toggle").click();
  await expect.poll(() => page.getByTestId("trace-step").count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(7);
  const sources = await page.getByTestId("trace-source").allTextContents();
  expect(sources.length).toBeGreaterThanOrEqual(3); // picks + host + pre-chats + talk cards
  for (const s of sources) expect(s).not.toMatch(/just now|Muse/);
  await expect(page.getByTestId("trace-ai-status").getByTestId("ai-status")).not.toContainText(/live/i);
  await page.keyboard.press("Escape");

  // squad chat: the host's lines say where they came from
  await page.getByTestId("open-squad-chat").click();
  const host = page.getByTestId("msg-host").first();
  await expect(host).toBeVisible();
  await expect(host.getByTestId("ai-source")).toHaveAttribute("data-source", /^(cache|fallback)$/);

  // talk cards: a template is never presented as AI
  await page.getByTestId("open-talk-cards").click();
  const line = page.locator('[data-testid^="talk-card-"]').first().getByTestId("openers-source");
  await expect(line).toBeVisible();
  await expect(line).toContainText(/saved AI response|template/);
});
