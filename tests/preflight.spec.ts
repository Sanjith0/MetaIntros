import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F25: preflight on /demo: one button, every check green with the projector open, and nothing live changes. */

test("preflight: ready for the demo with the projector open; reports a party left talking", async ({ browser, request }) => {
  test.setTimeout(120_000);
  await request.post("/api/demo/reset");
  const sctx = await browser.newContext();
  const stage = await sctx.newPage();
  await stage.goto("/stage");
  await expect(stage.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto("/demo");
  await page.getByTestId("preflight-run").click();
  await expect(page.getByTestId("preflight-verdict")).toHaveText("Ready for the demo", { timeout: 30_000 });
  for (const id of ["flags", "model", "pace", "rehearsal", "privacy", "live", "screens", "fallbacks"]) await expect(page.getByTestId(`preflight-${id}`)).toHaveAttribute("data-status", "ok");
  await expect(page.getByTestId("preflight-rehearsal")).toContainText("Dolores Night Market locked by five signatures");
  await expect(page.getByTestId("preflight-screens")).toContainText("Projector (/stage) connected.");
  const axe = await new AxeBuilder({ page }).include("[data-testid=preflight]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("preflight").screenshot({ path: "shots/f25-preflight.png" });

  // The rehearsal ran in a sandbox: the stage still shows nothing.
  await expect(stage.getByText("Waiting for a party to form")).toBeVisible();

  // Start the demo party live, then preflight again mid-talk: it says so.
  await request.post("/api/demo/settings", { data: { paceMs: 1500 } });
  await request.post("/api/demo/start", { data: { mode: "all" } });
  await page.getByTestId("preflight-run").click();
  await expect(page.getByTestId("preflight-live")).toHaveAttribute("data-status", "warn");
  await expect(page.getByTestId("preflight-live")).toContainText("A party is talking right now");
  await expect(page.getByTestId("preflight-verdict")).toContainText("Ready, with");
  await request.delete("/api/demo/settings");
  await sctx.close();
  await ctx.close();
});
