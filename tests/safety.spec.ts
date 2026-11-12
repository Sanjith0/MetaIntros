import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F15: the safety page: what code enforces, block, report (the reported person is never told), leave. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("safety: block and report from your party, and the other person hears nothing", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await lockedParty(request);

  const devCtx = await browser.newContext(PHONE);
  await devCtx.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
  const dev = await devCtx.newPage();
  await dev.goto("/events");
  await expect(dev.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  const ctx = await browser.newContext(PHONE);
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/party");
  await maya.getByTestId("party-safety-link").tap();
  await expect(maya.getByTestId("safety-enforced")).toContainText("18 and over");
  await expect(maya.getByTestId("safety-enforced")).toContainText("Public places only");
  await maya.screenshot({ path: "shots/f15-safety.png", animations: "disabled" });

  await maya.getByTestId("block-kai").tap();
  await expect(maya.getByTestId("safety-person-kai")).toContainText("Blocked");
  await maya.getByTestId("report-dev").tap();
  await expect(maya.getByTestId("report-dialog")).toContainText("isn't told");
  await maya.getByTestId("reason-uncomfortable").check();
  await maya.getByTestId("report-note").fill("kept talking over people");
  await maya.screenshot({ path: "shots/f15-report.png", animations: "disabled" });
  await maya.getByTestId("report-send").tap();
  await expect(maya.getByTestId("report-done")).toContainText("They aren't told");
  await expect(maya.getByTestId("safety-person-dev")).toContainText("Blocked");

  // Dev saw nothing: no toast, and nothing on his pages.
  await expect(dev.getByTestId("toast")).toHaveCount(0);
  await dev.goto("/party");
  const devText = await dev.locator("main").innerText();
  for (const t of ["kept talking over people", "Made me uncomfortable", "reported you", "Maya blocked"]) expect(devText).not.toContain(t);
  await Promise.all([ctx.close(), devCtx.close()]);
});

test("safety: leave before the plan is set, from the safety page", async ({ browser, baseURL, request }) => {
  try {
    await request.post("/api/demo/reset");
    await request.post("/api/demo/settings", { data: { paceMs: 1400 } });
    await request.post("/api/demo/start", { data: { mode: "all" } });
    const ctx = await browser.newContext(PHONE);
    await ctx.addCookies([{ name: "pq_viewer", value: "zoe", url: baseURL! }]);
    const zoe = await ctx.newPage();
    await zoe.goto("/safety");
    await zoe.getByTestId("safety-leave").getByTestId("leave-party").tap();
    await zoe.getByTestId("leave-yes").tap();
    await expect(zoe.getByTestId("no-party-title")).toHaveText("You left the party");
    await ctx.close();
  } finally {
    await request.delete("/api/demo/settings");
  }
});
