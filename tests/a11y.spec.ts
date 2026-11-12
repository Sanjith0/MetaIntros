import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F17: no serious or critical accessibility violations on any main route (axe-core), on a phone and on a laptop. */

const ROUTES = ["/events", "/event/evt-night-market", "/queue?event=evt-rooftop", "/party", "/chat", "/door", "/door/glasses", "/runitback", "/fair", "/fair?join=1", "/safety", "/stage", "/demo", "/phones", "/evals", "/fair/host", "/how", "/me"];

for (const [label, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["laptop", { width: 1280, height: 900 }],
] as const) {
  test(`accessibility on every main route (${label})`, async ({ browser, baseURL, request }) => {
    test.setTimeout(240_000);
    await lockedParty(request);
    const ctx = await browser.newContext({ viewport });
    await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    const page = await ctx.newPage();
    const problems: string[] = [];
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);
      const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
        problems.push(`${route} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      }
    }
    console.log(problems.length ? problems.join("\n") : "no serious or critical violations");
    expect(problems).toEqual([]);
    await ctx.close();
  });
}
