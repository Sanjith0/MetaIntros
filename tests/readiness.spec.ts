import { expect, test } from "@playwright/test";

/* F4: per-agent latency, a timeout answered by a labelled fallback, and a recorded replay labelled as recorded. */

test("real-model readiness: latency, a labelled fallback, a labelled recorded replay", async ({ page, browser, baseURL, request }) => {
  test.setTimeout(180_000);
  await request.post("/api/demo/reset");
  try {
    // A network-like run where Kai's agent never answers in time.
    await request.post("/api/demo/settings", { data: { simulateLatency: true, timeoutAgent: "kai", agentTimeoutMs: 2500 } });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/stage");
    await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await page.getByTestId("stage-start").click();
    await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 120_000 });
    const fallback = page.locator('[data-testid="source-chip"][data-source="fallback"]');
    expect(await fallback.count()).toBeGreaterThanOrEqual(3);
    await expect(fallback.first()).toContainText("timeout after 2500 ms");
    await expect(page.getByTestId("latency-kai")).toContainText("timeout");
    await expect(page.getByTestId("latency-maya")).toContainText(/r1 \d/);
    await page.screenshot({ path: "shots/f4-stage-fallback.png", animations: "disabled" });

    // Kai's own receipt says the fallback answered for him.
    const kai = await browser.newContext();
    await kai.addCookies([{ name: "pq_viewer", value: "kai", url: baseURL! }]);
    const kp = await kai.newPage();
    await kp.goto("/party");
    await expect(kp.getByTestId("receipt-fallback")).toContainText("In round 1 and 2 and 3 your agent didn't answer in time");
    await kai.close();

    // A recorded run replays, labelled as recorded and with where it came from.
    await request.delete("/api/demo/settings");
    await request.post("/api/demo/settings", { data: { source: "recorded" } });
    await page.getByTestId("stage-start").click();
    await expect(page.getByTestId("recorded-banner")).toContainText("Recorded replay · recorded from the mock model", { timeout: 30_000 });
    await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 120_000 });
    expect(await page.locator('[data-testid="source-chip"][data-source="recorded"]').count()).toBeGreaterThanOrEqual(15);
    await page.screenshot({ path: "shots/f4-stage-recorded.png", animations: "disabled" });
  } finally {
    await request.delete("/api/demo/settings");
  }
});
