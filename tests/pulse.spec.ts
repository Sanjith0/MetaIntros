import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F51: the Event page says how many are waiting near here tonight: counts only, "a few" under three. */

test("queue pulse: the Event page counts who's waiting nearby, without naming anyone", async ({ browser, baseURL, request }) => {
  test.setTimeout(120_000);
  await request.post("/api/demo/reset");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/event/evt-rooftop");
  await expect(page.getByTestId("queue-pulse")).toHaveText("Be the first in the queue near Dolores Park tonight.");

  for (const id of ["dev", "ana"]) await request.post("/api/queue/join", { data: { eventId: "evt-rooftop", sentence: DEMO_PARTY.sentences[id], consentBridges: true }, headers: { cookie: `pq_viewer=${id}` } });
  await page.reload();
  await expect(page.getByTestId("queue-pulse")).toHaveText("A few people are waiting near Dolores Park tonight.");

  await request.post("/api/queue/join", { data: { eventId: "evt-rooftop", sentence: DEMO_PARTY.sentences.kai, consentBridges: true }, headers: { cookie: "pq_viewer=kai" } });
  await page.reload();
  await expect(page.getByTestId("queue-pulse")).toHaveText("3 people are waiting near Dolores Park tonight.");
  for (const n of ["Dev", "Ana", "Kai"]) await expect(page.getByTestId("queue-pulse")).not.toContainText(n);
  await page.screenshot({ path: "shots/f51-queue-pulse.png" });
  await ctx.close();
});
