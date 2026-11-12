import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500, aiMode: "cache" } });
});

test("AI badges are everywhere Muse acts, and offline replays are never called live", async ({ page, request }) => {
  const status = await (await request.get("/api/ai/status")).json();
  expect(status.mode).toBe("cache");
  expect(status.state).not.toBe("live");

  await gotoReady(page, "/home");
  const header = page.locator("header").getByTestId("ai-status");
  await expect(header).toBeVisible();
  await expect(header).not.toContainText(/live/i);

  // queue: badge + rotating "what Muse weighs" line
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-5").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  const weighing = page.getByTestId("muse-weighing");
  await expect(weighing).toBeVisible();
  await expect(weighing).toHaveAttribute("data-live", "false"); // no live call in flight offline
  await expect(page.getByTestId("muse-weighing-item")).not.toBeEmpty();

  // match trace: every model step carries who wrote it; tool calls are marked as code
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("trace-ai-summary")).toBeVisible();
  const steps = page.getByTestId("trace-step");
  await expect(steps.nth(3)).toBeVisible({ timeout: 15_000 });
  const sources = await page.getByTestId("trace-steps").getByTestId("ai-source").evaluateAll((els) => els.map((e) => e.getAttribute("data-source")));
  expect(sources.length).toBeGreaterThan(0);
  expect(sources).not.toContain("live");
  expect(sources).toContain("code");

  // squad chat: AI host messages are badged
  await page.getByTestId("open-squad-chat").click();
  const host = page.getByTestId("msg-host").first();
  await expect(host).toBeVisible();
  await expect(host.getByTestId("ai-source")).toHaveAttribute("data-source", /^(cache|fallback)$/);

  // talk cards: openers are badged
  await page.getByTestId("open-talk-cards").click();
  await expect(page.locator('[data-testid^="talk-card-"]').first().getByTestId("openers-source").getByTestId("ai-source")).toBeVisible();
});
