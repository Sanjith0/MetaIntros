import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F10: pairwise reveal with a private chat, a standing party, and one identical queue-again card for everyone without a match. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("run it back: reveal, standing party, pair chat, and the same queue-again card", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const pick = (who: string, ids: string[]) => request.post("/api/runitback", { data: { partyId, pickedIds: ids }, headers: { cookie: `pq_viewer=${who}` } });
  await pick("dev", ["maya", "ana"]);
  await pick("ana", ["maya", "dev"]);

  const mayaCtx = await browser.newContext(PHONE);
  await mayaCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await mayaCtx.newPage();
  await maya.goto("/runitback");
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await maya.getByTestId("pick-dev").tap();
  await maya.getByTestId("pick-ana").tap();
  await maya.getByTestId("save-picks").tap();
  await expect(maya.getByTestId("mutual-ana")).toBeVisible();
  await expect(maya.getByTestId("mutual-dev")).toBeVisible();
  await expect(maya.getByTestId("standing-party")).toContainText("you all picked each other");
  await maya.screenshot({ path: "shots/f10-standing.png", animations: "disabled", fullPage: true });

  await maya.getByTestId("message-dev").tap();
  await expect(maya).toHaveURL(/\/chat\/chat-rib-/);
  await expect(maya.getByTestId("message-list")).toContainText("You both said yes to running it back");
  await maya.screenshot({ path: "shots/f10-pair-chat.png", animations: "disabled" });

  // Kai picked Zoe (not mutual); Zoe picked nobody. Their cards are identical.
  const texts: string[] = [];
  for (const [who, picks] of [
    ["kai", ["zoe"]],
    ["zoe", []],
  ] as const) {
    const ctx = await browser.newContext(PHONE);
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const p = await ctx.newPage();
    await p.goto("/runitback");
    await expect(p.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    for (const id of picks) await p.getByTestId(`pick-${id}`).tap();
    await p.getByTestId("save-picks").tap();
    await expect(p.getByTestId("queue-again")).toBeVisible();
    await expect(p.getByTestId("standing-party")).toHaveCount(0);
    texts.push(await p.getByTestId("queue-again").innerText());
    if (who === "kai") await p.screenshot({ path: "shots/f10-queue-again.png", animations: "disabled" });
    await ctx.close();
  }
  expect(texts[0]).toBe(texts[1]);
  await mayaCtx.close();
});
