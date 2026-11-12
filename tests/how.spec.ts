import { expect, test } from "@playwright/test";

/* F18: the architecture, in the app, for judges. */

test("how it works: the diagram and the guarantees", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/events");
  await page.getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how$/);
  const svg = page.getByTestId("architecture-diagram");
  await expect(svg).toBeVisible();
  for (const a of ["Maya", "Dev", "Ana", "Kai", "Zoe"]) await expect(svg.locator(`[data-box="agent-${a}"]`)).toContainText(`sees ${a}'s brief + the table`);
  await expect(svg).toContainText("Judge · code");
  await expect(svg).toContainText("Verifier · code");
  await expect(svg).toContainText("no reason, no name");
  await expect(page.getByTestId("how-guarantees").locator("li")).toHaveCount(13);
  await page.getByTestId("guarantee-9").getByTestId("guarantee-see").click();
  await expect(page).toHaveURL(/\/safety$/);
  await page.goBack();
  await expect(page.getByTestId("how-guarantees")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "shots/f29-proof-hub.png", fullPage: true });
  await page.screenshot({ path: "shots/f18-how.png", animations: "disabled", fullPage: true });
});
