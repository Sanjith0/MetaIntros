import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lockedParty } from "./helpers";

/* F57: Maya stops sharing "film photography"; Zoe's card about her loses the line built from it. */

test("take back what you shared: Maya stops sharing a fact and Zoe's card is rewritten", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const phone = async (who: string) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "pq_viewer", value: who, url: baseURL! }]);
    return { ctx, page: await ctx.newPage() };
  };
  const zoe = await phone("zoe");
  await zoe.page.goto("/party");
  await expect(zoe.page.getByTestId("party-members")).toContainText("Maya, what are you shooting on lately?");

  const maya = await phone("maya");
  await maya.page.goto("/me");
  await maya.page.getByTestId("stop-maya-f1").click();
  await expect(maya.page.getByTestId("stop-sharing-msg")).toContainText("Stopped sharing “film photography”.");
  await expect(maya.page.getByTestId("stop-maya-f1")).toHaveCount(0);
  await maya.page.getByTestId("data-sharing").screenshot({ path: "shots/f57-stop-sharing.png" });

  await zoe.page.reload();
  // Maya's row on Zoe's card (Dev and Zoe both list film photography themselves; that stays theirs).
  const mayaRow = zoe.page.getByTestId("party-members").locator(":scope > li", { hasText: "Maya Okafor" });
  await expect(mayaRow).not.toContainText("what are you shooting");
  await expect(mayaRow).not.toContainText("film photography");
  await expect(mayaRow).toContainText("Say hi, and ask how their night is going.");
  // At the door, too.
  await zoe.page.goto("/door");
  await expect(zoe.page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  const frame = JSON.parse(fs.readFileSync("fixtures/frames/dev-at-door.json", "utf8"));
  await request.post("/api/frames", { data: { ...frame, viewerId: "zoe", subjectKey: "maya", partyId } });
  await zoe.page.getByTestId("tap-maya").click();
  await expect(zoe.page.getByTestId("door-card-opener")).toHaveText("“Say hi, and ask how their night is going.”");
  await zoe.page.screenshot({ path: "shots/f57-door.png" });
  await zoe.ctx.close();
  await maya.ctx.close();
});
