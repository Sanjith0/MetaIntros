import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F45: nothing near Dolores Park fits Zoe's "home by nine"; her phone, and only hers, says the closest plan and the change. */

test("closest fit: Zoe is told privately which plan is closest and what would make it fit", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const sentences: Record<string, string> = { ...DEMO_PARTY.sentences, zoe: "open to anything, home by nine" };
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await request.post("/api/queue/join", { data: { eventId: DEMO_PARTY.entryEventId, sentence: sentences[id], consentBridges: true }, headers: { cookie: `pq_viewer=${id}` } });
  }
  await expect
    .poll(async () => ((await (await request.get("/api/party", { headers: { cookie: "pq_viewer=zoe" } })).json()) as { view: { party: { status: string } } | null }).view?.party.status, {
      timeout: 60_000,
    })
    .toBe("failed");

  const phone = async (who: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto("/party");
    return { ctx, page };
  };
  const zoe = await phone("zoe");
  await expect(zoe.page.getByTestId("party-status")).toHaveText("Nothing near Dolores Park fits your rules tonight");
  await expect(zoe.page.getByTestId("closest-fit")).toHaveText("Closest: Open Studio: Clay and Tea. It would fit if you could stay until 9:30 PM (you said “home by nine”).");
  await zoe.page.getByTestId("nomatch").screenshot({ path: "shots/f45-closest-fit.png" });

  // Maya was re-queued; she sees no hint and nothing of Zoe's.
  const maya = await phone("maya");
  await expect(maya.page.getByTestId("closest-fit")).toHaveCount(0);
  await expect(maya.page.locator("main")).not.toContainText("home by nine");
  await zoe.ctx.close();
  await maya.ctx.close();
});
