import { expect, test, type Page } from "@playwright/test";
import { gotoReady, lockIn, resetDemo } from "./helpers";

/**
 * DESIGN.md, enforced in the browser. No pixel snapshots: computed styles on /design are compared with
 * the tokens, and every route is checked at 390px for the three rules every screen must keep.
 */

test.setTimeout(180_000);

const css = (page: Page, testId: string, prop: string) =>
  page.getByTestId(testId).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const height = async (page: Page, testId: string) => Math.round((await page.getByTestId(testId).first().boundingBox())!.height);

test("/design: parts match the tokens", async ({ page, request }) => {
  await resetDemo(request);
  await gotoReady(page, "/design");
  await expect(page.getByTestId("design-gallery")).toBeVisible();

  // Buttons: 32 / 36 / 44 tall, 13 / 15 / 17px type, 6px radius; primary is the accent, secondary is control grey.
  for (const [size, h, fs] of [["sm", 32, 13], ["md", 36, 15], ["lg", 44, 17]] as const) {
    expect(await height(page, `spec-button-secondary-${size}`), `button ${size} height`).toBe(h);
    expect(await css(page, `spec-button-secondary-${size}`, "font-size"), `button ${size} type`).toBe(`${fs}px`);
    expect(await css(page, `spec-button-secondary-${size}`, "border-top-left-radius")).toBe("6px");
  }
  expect(await css(page, "spec-button-primary-md", "background-color")).toBe("rgb(8, 102, 255)");
  expect(await css(page, "spec-button-primary-md", "color")).toBe("rgb(255, 255, 255)");
  expect(await css(page, "spec-button-secondary-md", "background-color")).toBe("rgb(228, 230, 235)");
  expect(await css(page, "spec-button-secondary-md", "color")).toBe("rgb(5, 5, 5)");
  expect(await css(page, "spec-button-on-md", "background-color")).toBe("rgb(235, 245, 255)");
  expect(await css(page, "spec-button-on-md", "color")).toBe("rgb(0, 100, 209)");
  expect(await css(page, "spec-button-disabled", "color")).toBe("rgb(188, 192, 196)");

  // Type scale and the system font.
  for (const [t, fs] of [["tab", 11], ["meta", 13], ["body", 15], ["title", 17], ["headline", 20], ["page", 24], ["timer", 34]] as const) {
    expect(await css(page, `spec-text-${t}`, "font-size"), `text-${t}`).toBe(`${fs}px`);
  }
  expect(await css(page, "spec-text-body", "font-family")).toMatch(/^system-ui/);

  // Shape and colour tokens.
  for (const [r, v] of [["btn", "6px"], ["card", "8px"], ["sheet", "12px"], ["bubble", "18px"]] as const) {
    expect(await css(page, `spec-radius-${r}`, "border-top-left-radius"), `radius ${r}`).toBe(v);
  }
  for (const [c, v] of [
    ["accent", "rgb(8, 102, 255)"], ["link", "rgb(0, 100, 209)"], ["ink", "rgb(5, 5, 5)"], ["muted", "rgb(101, 103, 107)"],
    ["wash", "rgb(240, 242, 245)"], ["control", "rgb(228, 230, 235)"], ["divider", "rgb(206, 208, 212)"],
    ["badge", "rgb(228, 30, 63)"], ["date", "rgb(243, 66, 95)"], ["positive", "rgb(49, 162, 76)"],
  ] as const) {
    expect(await css(page, `spec-color-${c}`, "background-color"), `colour ${c}`).toBe(v);
  }

  // Chip: 32px pill. ListRow: at least 56px. Avatar: 40px. Top bar: 56px plus the 20px label strip.
  expect(await height(page, "spec-chip-on")).toBe(32);
  expect(await css(page, "spec-chip-on", "background-color")).toBe("rgb(235, 245, 255)");
  expect(await css(page, "spec-chip-off", "background-color")).toBe("rgb(228, 230, 235)");
  expect(await height(page, "spec-listrow")).toBeGreaterThanOrEqual(56);
  expect(await height(page, "spec-avatar-40")).toBe(40);
  expect(await height(page, "spec-topbar-home")).toBe(56 + 20 + 2);

  // Tab bar: six 52px tabs, 11px labels, 24px icons; the bar sits on the bottom edge.
  const tabs = page.locator('nav[aria-label="Main"] a');
  await expect(tabs).toHaveCount(6);
  for (let i = 0; i < 6; i++) {
    const tab = tabs.nth(i);
    expect(Math.round((await tab.boundingBox())!.height)).toBe(52);
    expect(await tab.evaluate((el) => getComputedStyle(el).fontSize)).toBe("11px");
  }
  expect(await tabs.first().locator("svg").first().evaluate((el) => Math.round(el.getBoundingClientRect().width))).toBe(24);

  // Sheet: grabber, headline title, closes on Escape. Toast: role=status.
  await page.getByTestId("spec-open-sheet").click();
  const sheet = page.getByTestId("spec-sheet");
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("12px");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.getByTestId("spec-show-toast").click();
  await expect(page.getByRole("status").getByText("Saved to your squad album")).toBeVisible();
});

/** Routes reachable from the seed. Squad routes are added once a squad has formed. */
const ROUTES = [
  "/", "/home", "/video", "/friends", "/friends?tab=requests", "/friends?tab=queueup", "/events", "/events?tab=nearby",
  "/events?tab=weekend", "/events/ev-indie-guild", "/events/ev-house-show", "/chats", "/notifications", "/profile",
  "/queue", "/queue/start?eventId=ev-indie-guild", "/join", "/demo", "/design", "/nope",
];

/** /design is a specimen sheet: it shows every button variant on purpose. */
const SPECIMEN = new Set(["/design"]);

async function checkRoute(page: Page, url: string) {
  await gotoReady(page, url);
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => {
    const visible = (el: Element) => {
      if (el.closest("[inert], [hidden], [aria-hidden='true']")) return false;
      const s = getComputedStyle(el);
      return el.getClientRects().length > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    // A primary is an action drawn in the accent. Selected toggles (tabs, radios, pressed chips) are state, not actions.
    const primaries = [...document.querySelectorAll("button, a, [role='button']")]
      .filter((el) => visible(el) && getComputedStyle(el).backgroundColor === "rgb(8, 102, 255)")
      .filter((el) => !el.matches("[aria-pressed], [aria-selected], [aria-checked], [role='tab'], [role='radio'], [role='switch']"))
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim());
    return {
      width: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      label: [...document.querySelectorAll('[data-testid="prototype-label"]')].some(visible),
      // Repeated identical row actions (Confirm on every friend request) count once.
      primaries: [...new Set(primaries)],
    };
  });
  expect(r.width, url).toBe(390);
  expect(r.overflow, `${url} scrolls sideways`).toBeLessThanOrEqual(1);
  expect(r.label, `${url} shows "Hackathon prototype, not Facebook"`).toBe(true);
  if (!SPECIMEN.has(url)) expect(r.primaries.length, `${url} primary buttons: ${r.primaries.join(" | ")}`).toBeLessThanOrEqual(1);
}

test("every route at 390px: no sideways scroll, at most one primary button, the prototype label", async ({ page, request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
  for (const url of ROUTES) await checkRoute(page, url);

  // A direct-message thread from the seed.
  await gotoReady(page, "/chats");
  const dm = await page.locator('[data-testid^="inbox-row-"]:not([data-type="squad"])').first().getAttribute("href");
  if (dm) await checkRoute(page, dm);

  // Form a squad, then every squad route.
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await lockIn(page, 30_000);
  await checkRoute(page, "/queue");
  const { partyId } = await (await page.request.get("/api/queue/status")).json();
  for (const sub of ["", "/cards", "/find", "/connect", "/album", "/share"]) await checkRoute(page, `/squad/${partyId}${sub}`);
  await gotoReady(page, `/squad/${partyId}`);
  await page.getByTestId("info-chat").click();
  await page.waitForURL(/\/chats\//);
  await checkRoute(page, new URL(page.url()).pathname);
});
