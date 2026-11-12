import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* M4 proof: five browser contexts, one per party member. Maya types her
 * sentence; code forms the party; the agents talk; plan.locked makes all
 * five show MATCH FOUND within 2 seconds, with sound. */

const PEOPLE = ["maya", "dev", "ana", "kai", "zoe"] as const;
const MAYA_PRIVATE = ["nowhere I have to drink", "out by eleven", "under twenty bucks"];

async function open(browser: Browser, baseURL: string, id: string, path: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([{ name: "pq_viewer", value: id, url: baseURL }]);
  const page = await ctx.newPage();
  await page.goto(path);
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  return { ctx, page };
}

test("demo path: five phones, one MATCH FOUND", async ({ browser, baseURL, request }) => {
  test.setTimeout(180_000);
  await request.post("/api/demo/reset");
  // Dev, Ana, Kai and Zoe each typed their sentence earlier and left.
  const seeded = await request.post("/api/demo/start", { data: { mode: "four" } });
  expect(seeded.ok()).toBeTruthy();

  const others = await Promise.all(["dev", "ana", "kai", "zoe"].map((id) => open(browser, baseURL!, id, "/events")));
  const maya = await open(browser, baseURL!, "maya", `/event/${DEMO_PARTY.entryEventId}`);
  const pages: Record<string, Page> = { maya: maya.page, dev: others[0]!.page, ana: others[1]!.page, kai: others[2]!.page, zoe: others[3]!.page };

  // Maya taps Find my party, types one sentence, and joins.
  await maya.page.getByTestId("find-my-party").click();
  await maya.page.getByTestId("sentence").fill(DEMO_PARTY.sentences.maya!);
  await expect(maya.page.getByTestId("brief-preview")).toBeVisible();
  await maya.page.getByTestId("join-queue").click();
  await expect(maya.page.getByTestId("party-forming")).toBeVisible({ timeout: 15_000 });

  // All five see MATCH FOUND.
  for (const id of PEOPLE) await expect(pages[id]!.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });

  const timing = await Promise.all(
    PEOPLE.map(async (id) => {
      const el = pages[id]!.getByTestId("match-found");
      const lockedAt = Date.parse((await el.getAttribute("data-locked-at"))!);
      const shownAt = Number(await el.getAttribute("data-shown-at"));
      await expect(el).not.toHaveAttribute("data-sound", "pending");
      return { id, lag: shownAt - lockedAt, sound: await el.getAttribute("data-sound"), partyId: await el.getAttribute("data-party-id") };
    }),
  );
  console.log("MATCH FOUND lag after plan.locked (ms):", timing.map((t) => `${t.id}=${t.lag} sound=${t.sound}`).join(" "));
  expect(new Set(timing.map((t) => t.partyId)).size).toBe(1);
  for (const t of timing) {
    expect(t.lag).toBeLessThanOrEqual(2000);
    expect(t.sound).toBe("played");
  }
  await maya.page.screenshot({ path: "shots/m4-match-found.png", animations: "disabled" });

  // /party shows the party card.
  await maya.page.getByRole("link", { name: "See your party" }).click();
  await expect(maya.page.getByTestId("party-card")).toBeVisible();
  await expect(maya.page.getByTestId("party-plan-title")).toHaveText("Dolores Night Market");
  await expect(maya.page.getByTestId("party-members").locator(":scope > li")).toHaveCount(4);
  await maya.page.screenshot({ path: "shots/m4-party.png", animations: "disabled" });

  // The Event page shows the RSVP with 5 Going.
  await maya.page.goto(`/event/${DEMO_PARTY.expectedPlanEventId}`);
  await expect(maya.page.getByTestId("party-rsvp-banner")).toContainText("5 going");
  await expect(maya.page.getByTestId("rsvp-going")).toHaveAttribute("aria-pressed", "true");
  await maya.page.screenshot({ path: "shots/m4-event-rsvp.png", animations: "disabled" });

  // The group chat opens with the plan pinned and one opener per person.
  await pages.dev!.getByRole("link", { name: "Open group chat" }).click();
  await expect(pages.dev!.getByTestId("pinned-banner")).toContainText("Dolores Night Market");
  await expect(pages.dev!.getByTestId("opener-message")).toHaveCount(5);
  await pages.dev!.screenshot({ path: "shots/m4-chat.png", animations: "disabled" });

  // No other member's page carries Maya's private rule text.
  for (const id of ["dev", "ana", "kai", "zoe"]) {
    const p = pages[id]!;
    for (const path of ["/party", `/event/${DEMO_PARTY.expectedPlanEventId}`]) {
      await p.goto(path);
      const html = await p.content();
      for (const t of MAYA_PRIVATE) expect(html, `${id} ${path}`).not.toContain(t);
    }
  }

  await Promise.all([maya.ctx, ...others.map((o) => o.ctx)].map((c) => c.close()));
});
