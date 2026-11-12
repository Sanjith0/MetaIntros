import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";
import { lockedParty } from "./helpers";

/* F56: Maya says Saturday was too loud; on Sunday her receipt says her agent used "prefers quiet". */

test("story memory: the next night's story says what the agent remembered", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const saturday = await lockedParty(request);
  await request.post("/api/memory", { data: { partyId: saturday, feeling: "loud", tags: ["quiet"] }, headers: { cookie: "pq_viewer=maya" } });
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await request.post("/api/queue/join", { data: { eventId: DEMO_PARTY.standingEventId, sentence: DEMO_PARTY.sentences[id], consentBridges: true }, headers: { cookie: `pq_viewer=${id}` } });
  }
  await expect
    .poll(async () => ((await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { id: string; status: string } } | null }).view?.party, {
      timeout: 90_000,
    })
    .toMatchObject({ status: "locked" });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  const story = page.getByTestId("agent-story");
  await expect(story).toContainText("It used what it remembers about you: prefers quiet (remembered from Dolores Night Market).");
  await story.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f56-story-memory.png" });
  await ctx.close();
});
