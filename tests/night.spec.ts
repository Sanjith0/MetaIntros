import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F14: queue for the whole night; the party picks from every event that evening. */

test("whole night: Maya queues for anywhere tonight; the agents pick among events across the city", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const starts: Record<string, string> = { dev: "evt-ggp-walk", ana: "evt-lake-games", kai: "evt-us-lang", zoe: "evt-lake-boats" };
  for (const [id, eventId] of Object.entries(starts)) {
    const r = await request.post("/api/queue/join", {
      data: { eventId, sentence: DEMO_PARTY.sentences[id], consentBridges: true, scope: "night" },
      headers: { cookie: `pq_viewer=${id}` },
    });
    expect(r.ok()).toBeTruthy();
  }

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto(`/queue?event=${DEMO_PARTY.entryEventId}`);
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(maya.getByTestId("scope-event")).toContainText("Near Dolores Park");
  await expect(maya.getByTestId("scope-night")).toContainText("Anywhere tonight");
  await maya.getByTestId("sentence").fill(DEMO_PARTY.sentences.maya!);
  await expect(maya.getByTestId("brief-preview")).toBeVisible();
  await maya.getByTestId("scope-night").tap();
  await expect(maya.getByTestId("scope-night")).toHaveAttribute("aria-checked", "true");
  await maya.getByTestId("scope-choice").scrollIntoViewIfNeeded();
  await maya.screenshot({ path: "shots/f14-scope.png", animations: "disabled" });
  await maya.getByTestId("join-queue").tap();

  await expect(maya.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });
  await maya.goto("/party");
  const chips = maya.getByTestId("party-table").locator("ul").first().locator("li");
  expect(await chips.count()).toBeGreaterThanOrEqual(8);
  await expect(maya.getByTestId("party-table")).toContainText("Botanical Garden Night Walk");
  await expect(maya.getByTestId("party-table")).toContainText("Board Games by the Lake");
  await maya.getByTestId("party-table").scrollIntoViewIfNeeded();
  await maya.screenshot({ path: "shots/f14-night-table.png", animations: "disabled" });
  await ctx.close();
});
