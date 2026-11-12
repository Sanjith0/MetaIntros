import { expect, test } from "@playwright/test";
import { gotoReady } from "./helpers";

for (const route of ["/", "/demo"]) {
  test(`boots ${route} without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await gotoReady(page, route);
    expect(res?.ok()).toBe(true);
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("health endpoint reports db ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ ok: true, db: true });
});
