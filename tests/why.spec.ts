import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F13: "why this plan", from code checks only, without anyone else's rules. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("why this plan: your own checks, everyone else's only as 'all passed'", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);
  const mayaCtx = await browser.newContext(PHONE);
  await mayaCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await mayaCtx.newPage();
  await maya.goto("/party");
  const card = maya.getByTestId("why-plan");
  await expect(card).toContainText("Why Dolores Night Market");
  await expect(card).toContainText('Your rule "No drink minimum": no drink minimum');
  await expect(card).toContainText("Every other member's private rules: all passed");
  await expect(card).toContainText("All five signed it");
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: "shots/f13-why-plan.png", animations: "disabled" });

  const devCtx = await browser.newContext(PHONE);
  await devCtx.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
  const dev = await devCtx.newPage();
  await dev.goto("/party");
  await expect(dev.getByTestId("why-plan")).toContainText('Your rule "$40 or less": Free');
  const text = await dev.getByTestId("why-plan").innerText();
  for (const t of ["No drink minimum", "Done by 11 PM", "$20 or less"]) expect(text).not.toContain(t);
  await Promise.all([mayaCtx.close(), devCtx.close()]);
});
