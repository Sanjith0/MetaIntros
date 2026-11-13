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

/**
 * Ready = React has hydrated (clicks before hydration are silently lost) AND streamed page segments have been
 * swapped in (the root marker can fire while a page is still a hidden `<div id="S:0">`, which would make
 * every test id appear twice for a moment).
 */
const isReady = () => document.documentElement.dataset.hydrated === "1" && !document.querySelector('div[hidden][id^="S:"]');

/** Navigate and wait until the page is ready. */
export async function gotoReady(page: Page, url: string) {
  let res = await page.goto(url);
  if (res && res.status() >= 500) res = await page.goto(url); // one retry for transient dev-server errors
  await page.waitForFunction(isReady);
  return res;
}

export async function reloadReady(page: Page) {
  await page.reload();
  await page.waitForFunction(isReady);
}

/** Ready check: tap "I'm in" on the squad you were matched with and wait for the reveal. */
export async function lockIn(page: Page, timeout = 30_000) {
  await expect(page.getByTestId("ready-check")).toBeVisible({ timeout });
  await page.getByTestId("accept-party").click();
  await expect(page.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
}
