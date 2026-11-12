import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/* F34: Maya changes her sentence while waiting; her rules update and the timer keeps running from when she joined. */

test("change your sentence while you wait: new rules, same place in line", async ({ browser, baseURL, request }) => {
  test.setTimeout(120_000);
  await request.post("/api/demo/reset");
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  await page.goto("/queue?event=evt-rooftop");
  await page.getByTestId("sentence").fill("chill people, out by eleven, under twenty bucks, nowhere I have to drink");
  await expect(page.getByTestId("brief-preview")).toBeVisible();
  await page.getByTestId("join-queue").click();
  await expect(page.getByTestId("queue-sentence-text")).toHaveText("“chill people, out by eleven, under twenty bucks, nowhere I have to drink”");
  const before = (await (await request.get("/api/queue/status", { headers: { cookie: "pq_viewer=maya" } })).json()) as { status: { entry: { id: string; joinedAt: string } } };

  await page.getByTestId("queue-edit").click();
  await page.getByTestId("sentence-edit").fill("chill people, home by midnight, under twenty bucks");
  await expect(page.getByTestId("sentence-edit-rules")).toContainText("Done by 12 AM");
  await expect(page.getByTestId("sentence-edit-rules")).not.toContainText("No drink minimum");
  const axe = await new AxeBuilder({ page }).include("[data-testid=queue-sentence]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("queue-sentence").screenshot({ path: "shots/f34-edit.png" });
  await page.getByTestId("queue-save-sentence").click();
  await expect(page.getByTestId("queue-saved")).toHaveText("Saved. You kept your place in line.");
  await expect(page.getByTestId("queue-sentence-text")).toHaveText("“chill people, home by midnight, under twenty bucks”");
  await page.screenshot({ path: "shots/f34-saved.png" });

  // Same entry, same join time.
  const after = (await (await request.get("/api/queue/status", { headers: { cookie: "pq_viewer=maya" } })).json()) as { status: { entry: { id: string; joinedAt: string }; sentence: string } };
  expect(after.status.entry).toMatchObject(before.status.entry);
  expect(after.status.sentence).toBe("chill people, home by midnight, under twenty bucks");
  await ctx.close();
});
