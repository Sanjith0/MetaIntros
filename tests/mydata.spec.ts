import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { lockedParty } from "./helpers";

/* F40: /me lists everything Party Queue holds about Maya, with where to change it, and downloads as JSON. */

test("your data: Maya sees what's hers, where to change it, and downloads it", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  await page.getByTestId("party-mydata-link").click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByTestId("data-brief")).toContainText("Rule: Done by 11 PM (“out by eleven”)");
  await expect(page.getByTestId("data-parties")).toContainText("Dolores Night Market (locked): 7 private agent decisions, 3 prompts, a receipt");
  await expect(page.getByTestId("data-parties").getByRole("link", { name: "Forget my night →" })).toHaveAttribute("href", "/safety");
  await expect(page.getByTestId("data-memory")).toContainText("Nothing.");
  for (const w of ["fine spending up to 40", "home by midnight", "nothing too loud", "budget around 25"]) await expect(page.locator("main")).not.toContainText(w);
  await page.screenshot({ path: "shots/f40-my-data.png", fullPage: true });

  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("my-data-download").click()]);
  expect(dl.suggestedFilename()).toBe("party-queue-maya.json");
  const json = JSON.parse(fs.readFileSync((await dl.path())!, "utf8")) as { userId: string; sections: { id: string }[] };
  expect(json.userId).toBe("maya");
  expect(json.sections.map((s) => s.id)).toContain("brief");
  await ctx.close();
});
