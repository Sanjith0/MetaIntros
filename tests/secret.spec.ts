import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F2: Maya's secret on her phone; the party-knows column stays empty. */

test("Maya's secret: her rules on her phone, the party knows nothing", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);

  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const maya = await browser.newContext(phone);
  await maya.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await maya.newPage();
  await page.goto("/party");
  const panel = page.getByTestId("secret-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("secret-rule")).toHaveCount(3);
  await expect(page.getByTestId("secret-mine")).toContainText("No drink minimum");
  await expect(page.getByTestId("secret-mine")).toContainText("nowhere I have to drink");
  await expect(page.getByTestId("secret-party-knows")).toHaveAttribute("data-leaks", "0");
  await expect(page.getByTestId("secret-empty")).toContainText("Nothing");
  await expect(page.getByTestId("secret-party-knows")).toContainText("Rooftop Sunset Session · unavailable");
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: "shots/f2-secret.png", animations: "disabled" });

  // Dev's phone: his own rule only; nothing of Maya's anywhere on the page.
  const dev = await browser.newContext(phone);
  await dev.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
  const dp = await dev.newPage();
  await dp.goto("/party");
  await expect(dp.getByTestId("secret-mine")).toContainText("$40 or less");
  await expect(dp.getByTestId("secret-rule")).toHaveCount(1);
  const html = await dp.content();
  for (const t of ["nowhere I have to drink", "out by eleven", "under twenty bucks", "No drink minimum"]) expect(html).not.toContain(t);
  await Promise.all([maya.close(), dev.close()]);
});
