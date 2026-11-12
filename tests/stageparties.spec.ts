import { expect, test } from "@playwright/test";

/* F28: the projector pins Saturday's party while Sunday's standing party forms, then follows the new one. */

test("stage party switcher: pin Saturday while Sunday's party talks, then follow the new one", async ({ page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  const r = await request.post("/api/demo/standing"); // Saturday locks; Dev, Ana, Priya and Theo queue for Sunday
  const { partyId: saturday } = (await r.json()) as { partyId: string };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("stage-party")).toHaveCount(0); // one party so far: no switcher

  // Maya joins Sunday with her standing party: a second party forms.
  await request.post("/api/queue/join", {
    data: { eventId: "evt-ferry-trivia", sentence: "chill, out by eleven, under twenty bucks", consentBridges: true, groupOf: saturday },
    headers: { cookie: "pq_viewer=maya" },
  });
  const sw = page.getByTestId("stage-party");
  await expect(sw).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="stage-plans"]')).toContainText("Waterfront Trivia Night"); // following: Sunday is on

  // Pin Saturday: the board goes back to the market and stays there while Sunday keeps talking.
  await sw.selectOption({ label: "Sat · Dolores Park · locked" });
  await expect(page).toHaveURL(new RegExp(`party=${saturday}`));
  await expect(page.getByTestId("stage-status")).toHaveText("Locked");
  await expect(page.locator('[data-testid="stage-plans"] [data-state="locked"]')).toContainText("Dolores Night Market");
  await page.waitForTimeout(2500);
  await expect(page.locator('[data-testid="stage-plans"]')).not.toContainText("Waterfront Trivia Night");
  await expect(sw.locator("option")).toContainText(["Follow new parties", /Sun · Ferry Building · (talking|locked)/, "Sat · Dolores Park · locked"]);
  await page.screenshot({ path: "shots/f28-stage-pinned.png", animations: "disabled" });

  // A refresh keeps the pin.
  await page.reload();
  await expect(page.locator('[data-testid="stage-plans"] [data-state="locked"]')).toContainText("Dolores Night Market");

  // Follow new parties again: Sunday is back.
  await page.getByTestId("stage-party").selectOption("");
  await expect(page.locator('[data-testid="stage-plans"]')).toContainText("Waterfront Trivia Night");
  await expect(page).not.toHaveURL(/party=/);
});
