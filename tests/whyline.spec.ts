import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lockedParty } from "./helpers";

/* F23: "Why this?" under every card and at the door: the approved facts a line came from, in plain words. */

test("why this line: Maya opens the sources of her opener for Dev, on /party and at the door", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();

  await page.goto("/party");
  const why = page.getByTestId("why-dev");
  await expect(why).toBeVisible();
  await why.getByText("Why this?").click();
  const items = page.getByTestId("why-dev-items").locator("li");
  await expect(items).toHaveText([
    "Dev listed “farmers market” on their profile and approved sharing it.",
    "You listed “farmers market” on your profile and approved sharing it.",
    "Code found a friend you share. They aren't named: they haven't opted in.",
  ]);
  await expect(page.getByTestId("why-dev")).toContainText("The model only chose which facts.");
  await why.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f23-why-party.png" });
  const axe = await new AxeBuilder({ page }).include("[data-testid=why-dev]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // At the door: no raw ids any more, the same plain sources.
  await page.goto("/door");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("im-here").click();
  const frame = JSON.parse(fs.readFileSync("fixtures/frames/dev-at-door.json", "utf8"));
  await request.post("/api/frames", { data: { ...frame, partyId } });
  await expect(page.getByTestId("door-card-name")).toHaveText("Dev");
  await expect(page.getByTestId("door-card")).not.toContainText("dev-f4");
  await page.getByTestId("door-why").getByText("Why this?").click();
  await expect(page.getByTestId("door-why-items").locator("li")).toHaveCount(3);
  await page.getByTestId("door-why").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f23-why-door.png" });
  await ctx.close();
});
