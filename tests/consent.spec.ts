import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F60: Maya's consent history on /me: what she agreed to, when, and what she took back. */

test("consent history: agreements and take-backs, newest first, on Maya's /me", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const asMaya = { headers: { cookie: "pq_viewer=maya" } };
  await request.post("/api/memory", { data: { partyId, feeling: "loud", tags: ["quiet"] }, ...asMaya });
  await request.post("/api/forget/keep", { data: { partyId, keep: true }, ...asMaya });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/me");
  await page.getByTestId("stop-maya-f1").click();
  await expect(page.getByTestId("stop-sharing-msg")).toBeVisible();
  await page.reload();
  const items = page.getByTestId("data-consents").locator("li");
  await expect(items).toHaveText([
    "Took back · Stopped sharing “film photography”; everything built from it was rewritten.",
    "Agreed · Chose to keep your private data from Dolores Night Market after the night.",
    "Agreed · Let your agent remember: prefers quiet (from Dolores Night Market).",
    /^Agreed · Queued for Rooftop Sunset Session: your party may see how you're tied/,
  ]);
  await page.getByTestId("data-consents").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f60-consent-history.png" });
  await ctx.close();
});
