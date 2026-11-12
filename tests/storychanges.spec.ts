import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F61: after a switch to plan B, Maya's story still names the plan five signed, then the switch. */

test("story after the lock: the lock and the switch to plan B, in code's voice", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  for (const who of ["dev", "kai", "zoe"]) await request.post("/api/party/switch", { data: { partyId }, headers: { cookie: `pq_viewer=${who}` } });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  const story = page.getByTestId("agent-story");
  await expect(story).toContainText("Code locked Dolores Night Market with all five signatures.");
  await expect(story.locator("li").last()).toContainText("Your party switched to plan B: Open Studio: Clay and Tea (three of five asked). It fits your rules too.");
  await story.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f61-story-switch.png" });
  await ctx.close();
});
