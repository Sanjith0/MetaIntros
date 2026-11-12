import { expect, test } from "@playwright/test";

/* F20: on the projector, type Maya's limits as Dev's agent; the verifier blocks it live and no phone hears it. */

test("try to leak it: Dev's agent types Maya's limits, the verifier blocks it, Maya's phone still shows nothing", async ({ browser, page, request, baseURL }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("stage-start").click();
  await expect(page.getByTestId("stage-status")).toHaveText("Locked", { timeout: 90_000 });

  // Maya's phone is open the whole time.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const maya = await ctx.newPage();
  await maya.goto("/party");
  await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });

  await page.getByTestId("leak-open").click();
  const box = page.getByTestId("leak-test");
  await expect(box).toBeVisible();
  await expect(page.getByTestId("leak-text")).toBeFocused();
  await expect(page.getByTestId("leak-actor")).toHaveValue("dev");
  await expect(page.getByTestId("leak-text")).toHaveValue(/out by eleven and nowhere I have to drink/);
  await page.getByTestId("leak-run").click();
  const result = page.getByTestId("leak-result");
  await expect(result).toHaveAttribute("data-ok", "false");
  await expect(result).toContainText("Blocked by the verifier: it isn't one of Dev's approved lines or a neutral phrase");
  await expect(page.getByTestId("leak-holds")).toContainText("Maya's private words “out by eleven”, “nowhere I have to drink”");
  await expect(page.getByTestId("leak-table-sees")).toHaveText("That works for me.");
  await expect(page.getByTestId("leak-prompt")).toContainText("its own brief only");
  await page.screenshot({ path: "shots/f20-leak-blocked.png", animations: "disabled" });

  // The exact neutral phrase goes through: the verifier isn't just blocking everything.
  await page.getByRole("button", { name: "A neutral phrase, exactly" }).click();
  await page.getByTestId("leak-run").click();
  await expect(result).toHaveAttribute("data-ok", "true");

  // Escape closes; the attempt shows in the private column for the room.
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(page.locator('[data-testid="trace-private"]', { hasText: "Leak attempt blocked · Dev's agent" })).toHaveCount(1);
  await page.locator('[data-testid="trace-private"]', { hasText: "Leak attempt blocked" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "shots/f20-leak-trace.png", animations: "disabled" });

  // Maya's phone heard nothing, and "what the party knows" is still empty.
  await maya.reload();
  await expect(maya.getByText("out by eleven", { exact: false }).first()).toBeVisible(); // her own rules, on her own phone
  await expect(maya.getByTestId("secret-party-knows")).toHaveAttribute("data-leaks", "0");
  const dev = await request.get("/api/party", { headers: { cookie: "pq_viewer=dev" } });
  expect(await dev.text()).not.toContain("nowhere I have to drink");
  await ctx.close();
});
