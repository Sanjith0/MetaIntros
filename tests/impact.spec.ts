import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F55: the event the party picked says what Party Queue brings to it: whole parties, and how many are already here. */

test("event impact: the market's page counts the party coming and the people already here", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "priya", url: baseURL! }]); // someone outside the party
  const page = await ctx.newPage();
  await page.goto("/event/evt-night-market");
  await expect(page.getByTestId("event-impact")).toHaveText("Party Queue: 1 party of five is coming tonight.");
  await request.post("/api/door/arrive", { data: { partyId }, headers: { cookie: "pq_viewer=dev" } });
  await page.reload();
  await expect(page.getByTestId("event-impact")).toHaveText("Party Queue: 1 party of five is coming tonight · 1 already here.");
  for (const n of ["Dev", "Maya", "Ana", "Kai", "Zoe"]) await expect(page.getByTestId("event-impact")).not.toContainText(n);
  await expect(page.getByTestId("queue-pulse")).not.toContainText("formed here"); // said once, by the line above
  await page.screenshot({ path: "shots/f55-event-impact.png" });
  await ctx.close();
});
