import { expect, test } from "@playwright/test";

/* F12: /evals shows the leak test four ways; running it never touches a live phone. */

test("evals page: the leak test four ways, isolated from the live demo", async ({ page, browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");

  // A phone is live while the evals run: it must hear nothing from the eval parties.
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await phoneCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const phone = await phoneCtx.newPage();
  await phone.goto("/events");
  await expect(phone.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/evals");
  await expect(page.getByTestId("evals-table")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("evals-col-one-prompt")).toContainText("Simulated");
  await expect(page.getByTestId("cell-five-agents-leaking-lines")).toHaveText(/^0 of \d+$/);
  await expect(page.getByTestId("cell-five-agents-leaks")).toHaveText("0");
  await expect(page.getByTestId("cell-five-agents-exposure")).toHaveText("0");
  await expect(page.getByTestId("cell-five-agents-feasible")).toHaveText("25 of 25");
  await expect(page.getByTestId("cell-one-prompt-exposure")).toHaveText("4");
  await expect(page.getByTestId("cell-one-prompt-leaking-lines")).not.toHaveText(/^0 of/);
  await expect(page.getByTestId("cell-one-prompt-verifier-leaks")).toHaveText("0");
  await expect(page.getByTestId("cell-solver-leaking-lines")).toHaveText("no lines");
  await page.screenshot({ path: "shots/f12-evals.png", animations: "disabled", fullPage: true });

  await page.getByTestId("evals-rerun").click();
  await expect(page.getByTestId("evals-rerun")).toHaveText("Run again", { timeout: 60_000 });

  await expect(phone.getByTestId("match-found")).toHaveCount(0);
  await expect(phone.getByTestId("toast")).toHaveCount(0);
  await phoneCtx.close();
});
