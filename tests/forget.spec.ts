import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F24: Maya forgets her night from /safety; a scan of the server finds none of her words. */

test("forget my night: Maya deletes her private data; the scan finds none of her words; Dev's party is untouched", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const devBefore = await (await request.get("/api/party", { headers: { cookie: "pq_viewer=dev" } })).text();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();

  await page.goto("/safety");
  const box = page.getByTestId("safety-forget");
  await expect(box).toContainText("Dolores Night Market");
  await page.getByTestId("forget-start").click();
  await expect(box).toContainText("This can't be undone.");
  const axe = await new AxeBuilder({ page }).include("[data-testid=safety-forget]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("forget-confirm").click();
  const result = page.getByTestId("forget-result");
  await expect(result).toHaveAttribute("data-found", "0");
  await expect(result).toContainText(/Done\. Then code read all [\d,]+ values on the server: none hold your words\./);
  await expect(page.getByTestId("forget-removed")).toContainText("your rules (3)");
  await box.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f24-forget.png" });

  // Her party page: the secret panel and receipt are gone, with a note why.
  await page.goto("/party");
  await expect(page.getByTestId("party-forgotten")).toBeVisible();
  await expect(page.getByTestId("secret-panel")).toHaveCount(0);
  await expect(page.getByTestId("receipt")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("nowhere I have to drink");
  await page.goto("/safety");
  await expect(page.getByTestId("forget-done")).toBeVisible();

  // The projector's private notes about her are gone too.
  const stage = (await (await request.get(`/api/stage?party=${partyId}`)).text());
  for (const w of ["out by eleven", "under twenty bucks", "nowhere I have to drink"]) expect(stage).not.toContain(w);
  expect(stage).toContain("Forgotten at Maya's request.");

  // Dev's view of the party is the same as before.
  expect(await (await request.get("/api/party", { headers: { cookie: "pq_viewer=dev" } })).text()).toBe(devBefore);
  await ctx.close();
});
