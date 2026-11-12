import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F43: private data from a night is deleted automatically when the party chat closes, unless you keep it. */

test.afterEach(async ({ request }) => {
  await request.post("/api/demo/clock", { data: { to: "now" } });
});

test("forget by default: Maya sees when it goes, can keep it, and after the night it's gone", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/safety");
  const auto = page.getByTestId("forget-auto");
  await expect(auto).toContainText("Otherwise it's deleted automatically when your party chat closes, Sun 10 AM.");
  await page.getByTestId("forget-keep").click();
  await expect(auto).toContainText("You chose to keep it after the night.");
  await page.getByTestId("forget-keep").click();
  await expect(auto).toContainText("deleted automatically");
  await page.getByTestId("safety-forget").screenshot({ path: "shots/f43-auto-forget.png" });

  // The night ends: the clock moves past the chat closing.
  await request.post("/api/demo/clock", { data: { to: "after-event" } });
  await page.goto("/me");
  await expect(page.getByTestId("data-parties")).toContainText("your private data was deleted automatically after the night");
  await expect(page.locator("main")).not.toContainText("nowhere I have to drink");
  await page.goto("/safety");
  await expect(page.getByTestId("forget-done")).toContainText("were deleted automatically after the night");
  const stage = await (await request.get("/api/stage")).text();
  for (const w of ["out by eleven", "spending up to 40", "home by midnight", "nothing too loud", "budget around 25"]) expect(stage).not.toContain(w);
  await page.screenshot({ path: "shots/f43-after.png" });
  await ctx.close();
});
