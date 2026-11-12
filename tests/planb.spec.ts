import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F53: plan B on the party card and in the chat. */

test("plan B: the party card and the chat name the next plan that fits everyone", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/party");
  await expect(page.getByTestId("plan-b")).toContainText("Plan B, if it doesn't work out: Open Studio: Clay and Tea · 7 PM–9:30 PM");
  await expect(page.getByTestId("plan-b")).toContainText("It fits everyone's rules too.");
  await page.getByTestId("party-card").screenshot({ path: "shots/f53-plan-b.png" });
  await page.getByRole("link", { name: "Group chat" }).click();
  await expect(page.getByTestId("message-list")).toContainText("Plan B, if Dolores Night Market doesn't work out: Open Studio: Clay and Tea");
  await ctx.close();
});
