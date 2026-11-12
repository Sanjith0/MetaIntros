import { expect, type APIRequestContext, type Page } from "@playwright/test";

export async function resetDemo(request: APIRequestContext) {
  const r = await request.post("/api/demo/reset");
  expect(r.ok()).toBe(true);
}

export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} @ ${new URL(page.url()).pathname}`);
  });
  page.on("pageerror", (e) => errors.push(`${e.message} @ ${new URL(page.url()).pathname}`));
  return errors;
}

/** Navigate and wait until React has hydrated (clicks before hydration are silently lost). */
export async function gotoReady(page: Page, url: string) {
  let res = await page.goto(url);
  if (res && res.status() >= 500) res = await page.goto(url); // one retry for transient dev-server errors
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
  return res;
}

export async function reloadReady(page: Page) {
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "1");
}
