import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F49: Maya waits alone near Dolores Park; one tap widens her to anywhere tonight, and she lands with four waiting at Lake Merritt. */

test("widen the search: one tap from 1 of 5 near Dolores Park to a party tonight", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  for (const id of ["dev", "ana", "kai", "zoe"]) {
    await request.post("/api/queue/join", { data: { eventId: "evt-lake-games", sentence: DEMO_PARTY.sentences[id], consentBridges: true }, headers: { cookie: `pq_viewer=${id}` } });
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/queue?event=evt-rooftop");
  await page.getByTestId("sentence").fill(DEMO_PARTY.sentences.maya!);
  await expect(page.getByTestId("brief-preview")).toBeVisible();
  await page.getByTestId("join-queue").click();
  const widen = page.getByTestId("widen");
  await expect(widen).toContainText("Only 1 of 5 near Dolores Park so far.");
  await expect(widen).toContainText("and keep your place.");
  const axe = await new AxeBuilder({ page }).include("[data-testid=widen]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: "shots/f49-widen.png", animations: "disabled" });
  await page.getByTestId("widen-go").click();
  await expect(page.getByTestId("party-forming")).toBeVisible({ timeout: 15_000 });
  const v = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { members: { id: string }[] } };
  expect(v.view.members.map((m) => m.id).sort()).toEqual(["ana", "dev", "kai", "maya", "zoe"]);
  await ctx.close();
});
