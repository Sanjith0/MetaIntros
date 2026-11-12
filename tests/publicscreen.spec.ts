import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { waitForLock } from "./helpers";
import { DEMO_PARTY } from "../fixtures/demo";

/* F41: the projector in public screen mode shows nothing personal: a scan of the whole page finds no names, rules or lines. */

test("public screen: the whole projector page holds no names, nobody's rules and no agent's words", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("public-toggle").click();
  await expect(page).toHaveURL(/screen=public/);
  await page.getByTestId("stage-start").click();
  await waitForLock(page, 90_000);
  await expect(page.getByTestId("signature-count")).toHaveText("5 of 5 signed");
  await expect(page.getByTestId("stage-caption")).toHaveText("Code locked Dolores Night Market. MATCH FOUND on all five phones.");
  await expect(page.getByTestId("leak-open")).toHaveCount(0);
  await expect(page.getByTestId("whatif-open")).toHaveCount(0);
  await expect(page.getByTestId("stage-private")).toHaveCount(0);

  // The stage covers the whole screen (the app shell underneath, with its user switcher, isn't visible).
  const text = await page.getByTestId("stage").innerText();
  const words = [
    "Maya", "Dev", "Ana", "Kai", "Zoe",
    ...Object.values(DEMO_PARTY.sentences),
    "out by eleven", "under twenty bucks", "nowhere I have to drink", "spending up to 40", "home by midnight", "nothing too loud", "budget around 25",
    "About me", "Up for something low-key", "Happy to go with the group", "I'm in",
  ];
  for (const w of words) expect(text, w).not.toContain(w);
  expect(text).toContain("Rooftop Sunset Session · unavailable");
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " :: " + (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160)).slice(0, 3).join(" | ")}`)).toEqual([]);
  await page.screenshot({ path: "shots/f41-public-screen.png", animations: "disabled" });

  // A reload keeps it; turning it off brings the lanes back.
  await page.reload();
  await expect(page.getByTestId("stage-public")).toBeVisible();
  await page.getByTestId("public-toggle").click();
  await expect(page.getByTestId("stage-private")).toBeVisible();
  await expect(page).not.toHaveURL(/screen=public/);
});
