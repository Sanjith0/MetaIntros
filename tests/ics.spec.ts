import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lockedParty } from "./helpers";

/* F38: Add to calendar downloads the locked plan as an .ics file. */

test("add to calendar: the party card downloads the plan as .ics", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("add-to-calendar").click()]);
  expect(dl.suggestedFilename()).toBe("party-queue-dolores-night-market.ics");
  const body = fs.readFileSync((await dl.path())!, "utf8");
  expect(body).toContain("SUMMARY:Dolores Night Market");
  expect(body).toContain("DTSTART;TZID=America/Los_Angeles:20261114T180000");
  for (const n of ["Dev", "Ana", "Kai", "Zoe"]) expect(body).not.toContain(n);
  await page.getByTestId("party-card").screenshot({ path: "shots/f38-calendar.png" });
  await ctx.close();
});
