import { expect, test } from "@playwright/test";
import { gotoReady, reloadReady, resetDemo } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("the brief: what my Companion may share is mine to decide, and it sticks", async ({ page, request }) => {
  const brief = await (await request.get("/api/companion/brief")).json();
  expect(brief.facts.length).toBeGreaterThan(3);
  expect(JSON.stringify(brief)).not.toMatch(/church|democrat|republican|therapy/i);
  expect((await request.post("/api/companion/brief/share", { data: { factId: "p01:likes[999]", share: "open" } })).status()).toBe(404);
  expect((await request.post("/api/companion/brief/share", { data: { factId: brief.facts[0].id, share: "loud" } })).status()).toBe(422);

  await gotoReady(page, "/profile");
  const card = page.getByTestId("brief-card");
  await expect(card).toBeVisible();
  const first = card.getByTestId("brief-fact").first();
  await expect(first).toHaveAttribute("data-share", "open");
  await first.getByTestId("brief-share-private").click();
  await expect(first).toHaveAttribute("data-share", "private");
  await reloadReady(page);
  await expect(page.getByTestId("brief-fact").first()).toHaveAttribute("data-share", "private");
  const after = await (await request.get("/api/companion/brief")).json();
  expect(after.facts[0].share).toBe("private");
});

test("queueing runs the Companion engine: squad of the chosen size, visible trace, Companion conversations on the cards", async ({ page }) => {
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await expect(page.getByTestId("companion-note")).toBeVisible();
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId("party-members").locator("li")).toHaveCount(4);

  const trace = page.getByTestId("trace-panel");
  await expect(trace.getByTestId("trace-step").first()).toBeVisible();
  await expect(trace).toContainText("Orchestrator", { timeout: 15_000 });
  await expect(trace).toContainText("Companions", { timeout: 15_000 });
  await expect(trace).toContainText("signed off", { timeout: 15_000 });

  await page.getByTestId("open-squad-chat").click();
  await page.getByTestId("open-talk-cards").click();
  const pre = page.locator('[data-testid^="talk-card-"]').first().getByTestId("prechat");
  await expect(pre.getByTestId("prechat-label")).toHaveText("AI simulation");
  await pre.locator("summary").click();
  await expect(pre).toContainText("Each one knew only its own person");
  expect(await pre.getByTestId("prechat-thread").locator("li").count()).toBeGreaterThanOrEqual(6);
});
