import { expect, test } from "@playwright/test";

/* F1: /stage live, then scrubbed back to round 2. */

test("stage: live replay with a scrubber, rejections in red, signatures landing", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByText("Waiting for a party to form")).toBeVisible();

  // Live: start the party from the stage and follow it to the lock.
  await page.getByTestId("stage-start").click();
  await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 90_000 });
  await expect(page.locator('[data-testid="stage-plans"] [data-state="locked"]')).toContainText("Dolores Night Market");
  await expect(page.locator('[data-testid="stage-plans"] [data-state="unavailable"]')).toHaveCount(3);
  for (const id of ["maya", "dev", "ana", "kai", "zoe"]) await expect(page.getByTestId(`sig-${id}`)).toHaveAttribute("data-sig", /signed|conceded/);
  expect(await page.locator('[data-tone="reject"]').count()).toBeGreaterThanOrEqual(7);
  await page.screenshot({ path: "shots/f1-stage-live.png", animations: "disabled" });

  // Scrub back to the end of round 2: Kai is holding, nothing is locked.
  const view = (await (await request.get("/api/stage")).json()) as { traces: { meta?: { kind?: string; round?: number } }[] };
  const idx = view.traces.findLastIndex((t) => t.meta?.kind === "verdicts" && t.meta.round === 2) + 1;
  await page.getByTestId("scrubber").fill(String(idx));
  await expect(page.getByTestId("stage-status")).toHaveText("Round 2");
  await expect(page.getByTestId("sig-kai")).toHaveAttribute("data-sig", "holding");
  await expect(page.locator('[data-testid="stage-plans"] [data-state="locked"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="stage-plans"] [data-state="leading"]')).toContainText("Dolores Night Market");
  await page.screenshot({ path: "shots/f1-stage-scrub.png", animations: "disabled" });

  // Play from the start: the board rebuilds from nothing.
  await page.getByTestId("scrubber").fill("0");
  await expect(page.getByTestId("stage-status")).toHaveText("Forming");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("stage-status")).toHaveText(/Round 1|Round 2|Round 3|Locked/, { timeout: 30_000 });
});
