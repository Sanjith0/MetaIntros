import { expect, test } from "@playwright/test";
import { waitForLock } from "./helpers";

/* F33: a caption on the projector says what just happened; it follows the scrubber too. */

test("stage captions: live to the lock, then scrubbed back to Kai holding out", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  const cap = page.getByTestId("stage-caption");
  await expect(cap).toHaveText("Waiting for the first move.");
  await page.getByTestId("stage-start").click();
  await waitForLock(page, 90_000);
  await expect(cap).toHaveText("Code locked Dolores Night Market. MATCH FOUND on all five phones.");
  await expect(cap).toHaveAttribute("aria-live", "polite");

  // Scrub to just after Kai's round-2 move.
  const view = (await (await request.get("/api/stage")).json()) as { traces: { actorId: string | null; meta?: { kind?: string; round?: number; decision?: string } }[] };
  const idx = view.traces.findIndex((t) => t.actorId === "kai" && t.meta?.kind === "verdicts" && t.meta.round === 2) + 1;
  expect(idx).toBeGreaterThan(0);
  await page.getByTestId("scrubber").fill(String(idx));
  await expect(cap).toHaveText("Kai's agent is holding out for Open Studio: Clay and Tea.");
  await expect(cap).toHaveAttribute("data-tone", "agent");
  await page.screenshot({ path: "shots/f33-captions.png", animations: "disabled" });

  // And back to the start: nothing has happened yet.
  await page.getByTestId("scrubber").fill("0");
  await expect(cap).toHaveText("Waiting for the first move.");
});
