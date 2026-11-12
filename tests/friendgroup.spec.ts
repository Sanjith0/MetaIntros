import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F44: Sam brings Zoe and Ana; Zoe gets the invite and joins with her own sentence; they land together with two new people. */

test("bring friends: Sam picks Zoe and Ana, Zoe joins from the invite, the three land in one party", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const phone = async (who: string, path: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto(path);
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    return { ctx, page };
  };
  const zoe = await phone("zoe", "/events");
  const sam = await phone("sam", "/queue?event=evt-rooftop");
  await sam.page.getByTestId("sentence").fill("anything chill works for me");
  await sam.page.getByTestId("group-friend-zoe").check();
  await sam.page.getByTestId("group-friend-ana").check();
  await expect(sam.page.getByTestId("group-pick")).toContainText("You'll all land in one party with 2 new people.");
  const axe = await new AxeBuilder({ page: sam.page }).include("[data-testid=group-pick]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await sam.page.getByTestId("group-pick").screenshot({ path: "shots/f44-group-pick.png" });
  await sam.page.getByTestId("join-queue").click();
  await expect(sam.page.getByTestId("queue-group")).toContainText("Waiting for");

  // Zoe: the invite, then the sheet with the group banner.
  const toast = zoe.page.getByText("Sam wants to queue with you as a group. You'd all be in one party, with new people.");
  await expect(toast).toBeVisible({ timeout: 15_000 });
  const status = (await (await request.get("/api/queue/status", { headers: { cookie: "pq_viewer=sam" } })).json()) as { status: { entry: { groupOf: string } } };
  await zoe.page.goto(`/queue?event=evt-rooftop&group=${status.status.entry.groupOf}`);
  await expect(zoe.page.getByTestId("standing-invite")).toContainText("Queuing with friends: Sam and Ana.");
  await zoe.page.waitForTimeout(400);
  await zoe.page.screenshot({ path: "shots/f44-invite.png", animations: "disabled" });
  await zoe.page.getByTestId("sentence").fill("open to anything, just want to meet people, budget around 25");
  await zoe.page.getByTestId("join-queue").click();

  // Two new people and Ana: the party forms with all three of them.
  for (const id of ["dev", "kai"]) await request.post("/api/queue/join", { data: { eventId: "evt-rooftop", sentence: "something social", consentBridges: true }, headers: { cookie: `pq_viewer=${id}` } });
  await request.post("/api/queue/join", { data: { eventId: "evt-rooftop", sentence: "low-key, home by midnight", consentBridges: true, groupOf: status.status.entry.groupOf }, headers: { cookie: "pq_viewer=ana" } });
  const v = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=sam" } })).json()) as { view: { members: { id: string }[] } };
  expect(v.view.members.map((m) => m.id).sort()).toEqual(["ana", "dev", "kai", "sam", "zoe"]);
  await zoe.ctx.close();
  await sam.ctx.close();
});
