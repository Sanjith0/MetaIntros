import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F54: three of five ask to switch to plan B; Maya's tap is the third; everyone's plan moves. */

test("switch to plan B: the third ask moves the party, and Ana's phone is told", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const phone = async (who: string, path: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    const page = await ctx.newPage();
    await page.goto(path);
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    return { ctx, page };
  };
  const ana = await phone("ana", "/events");
  for (const who of ["dev", "kai"]) await request.post("/api/party/switch", { data: { partyId }, headers: { cookie: `pq_viewer=${who}` } });
  const maya = await phone("maya", "/party");
  await expect(maya.page.getByTestId("switch-b-ask")).toHaveText("Switch to plan B (2 of 3 asked)");
  await maya.page.getByTestId("party-card").screenshot({ path: "shots/f54-switch-ask.png" });
  await maya.page.getByTestId("switch-b-ask").click();
  await expect(maya.page.getByTestId("party-plan-title")).toHaveText("Open Studio: Clay and Tea", { timeout: 10_000 });
  await expect(ana.page.getByText("Your party switched to plan B. Your RSVP moved.")).toBeVisible({ timeout: 10_000 });
  await maya.page.getByRole("link", { name: "Group chat" }).click();
  await expect(maya.page.getByTestId("message-list")).toContainText("Switched to plan B: 3 of 5 asked. Your RSVP moved.");
  await expect(maya.page.getByTestId("chat-title")).toHaveText("Open Studio: Clay and Tea · party of 5");
  await maya.page.screenshot({ path: "shots/f54-switched.png" });
  await ana.ctx.close();
  await maya.ctx.close();
});
