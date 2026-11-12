import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F26: a standing party queues again. Maya taps the invite, types her own sentence, and lands with Dev, Ana and two new people. */

test("standing party: Maya accepts the invite on her phone; the three land together with two new people", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/events");
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  // The presenter sets up Sunday: Dev and Ana queue with the standing party; two new people queue too.
  const r = await request.post("/api/demo/standing");
  const { partyId } = (await r.json()) as { partyId: string };

  // Her run-it-back page offers the next nights.
  await maya.goto("/runitback");
  await expect(maya.getByTestId("standing-queue")).toContainText("Queue together again");
  await expect(maya.getByTestId("standing-queue-evt-ferry-trivia")).toContainText("Sun");

  // The invite came as a toast; it opens the queue sheet for Sunday with the standing party.
  await maya.goto(`/queue?event=evt-ferry-trivia&group=${partyId}`);
  await expect(maya.getByTestId("standing-invite")).toContainText("Queuing with your standing party: Dev and Ana.");
  await expect(maya.getByTestId("duo-select")).toHaveCount(0);
  await maya.getByTestId("sentence").fill("chill, out by eleven, under twenty bucks");
  await expect(maya.getByTestId("brief-preview")).toBeVisible();
  const axe = await new AxeBuilder({ page: maya }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await maya.screenshot({ path: "shots/f26-standing-sheet.png" });
  await maya.getByTestId("join-queue").click();
  await expect(maya.getByTestId("party-forming")).toBeVisible({ timeout: 15_000 });

  // The new party: the three of them plus Priya and Theo, tied as "queued together".
  const view = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { id: string }; members: { id: string }[] } };
  expect(view.view.members.map((m) => m.id).sort()).toEqual(["ana", "dev", "maya", "priya", "theo"]);
  expect(view.view.party.id).not.toBe(partyId);
  await maya.goto("/party");
  await expect(maya.getByTestId("party-members")).toContainText("You queued together.");
  await expect(maya.getByTestId("party-members")).toContainText("Priya");
  await maya.screenshot({ path: "shots/f26-standing-party.png", fullPage: true });
  await ctx.close();
});
