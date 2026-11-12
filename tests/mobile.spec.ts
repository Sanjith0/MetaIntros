import { expect, test, type Page } from "@playwright/test";
import { lockedParty } from "./helpers";

/* Every route at a phone width (390 x 844). Nothing may scroll sideways. */

const W = 390;

async function check(page: Page, path: string, shot: string) {
  await page.goto(path);
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed";
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className?.toString() ?? "").split(" ").slice(0, 3).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: doc.scrollWidth, wide };
  });
  await page.screenshot({ path: `shots/mobile-${shot}.png`, animations: "disabled" });
  return overflow;
}

test("every route fits a 390-pixel phone", async ({ browser, baseURL, request }) => {
  test.setTimeout(240_000);
  const partyId = await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  const party = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { chatId: string } } };

  const routes: [string, string][] = [
    ["/events", "events"],
    ["/event/evt-rooftop", "event"],
    ["/event/evt-night-market", "event-rsvp"],
    ["/queue?event=evt-rooftop", "queue"],
    ["/party", "party"],
    [`/chat/${party.view.party.chatId}`, "chat"],
    ["/door", "door"],
    ["/runitback", "runitback"],
    ["/fair", "fair"],
    ["/fair?join=1", "fair-form"],
    ["/stage", "stage"],
  ];
  const results: Record<string, { scrollWidth: number; wide: string[] }> = {};
  for (const [path, shot] of routes) results[path] = await check(page, path, shot);
  console.log(JSON.stringify(results, null, 1));
  for (const [path, r] of Object.entries(results)) expect.soft(r.scrollWidth, `${path} scrolls sideways: ${r.wide.join(" | ")}`).toBeLessThanOrEqual(W);
  expect(partyId).toBeTruthy();
  await ctx.close();
});

test("phone: Maya joins from a 390-pixel screen and sees MATCH FOUND", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await request.post("/api/demo/start", { data: { mode: "four" } });
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/event/evt-rooftop");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("find-my-party").tap();
  await page.getByTestId("sentence").fill("chill people, out by eleven, under twenty bucks, nowhere I have to drink");
  await expect(page.getByTestId("brief-preview")).toBeVisible();
  await page.screenshot({ path: "shots/mobile-queue-preview.png", animations: "disabled" });
  await page.getByTestId("join-queue").tap();
  await expect(page.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("match-found")).not.toHaveAttribute("data-sound", "pending");
  await page.screenshot({ path: "shots/mobile-match-found.png", animations: "disabled" });
  const box = await page.getByTestId("match-found").boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(W);
  await page.getByRole("link", { name: "Open group chat" }).tap();
  await expect(page.getByTestId("composer")).toBeInViewport();
  await page.screenshot({ path: "shots/mobile-chat-after-match.png", animations: "disabled" });
  await ctx.close();
});
