import { expect, test } from "@playwright/test";
import { resetDemo, gotoReady } from "./helpers";

test.beforeEach(async ({ request }) => resetDemo(request));

test("two clients see each other's messages live", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage(); // presenter = Me (p01)
  const ctxB = await browser.newContext();
  const b = await ctxB.newPage();
  await b.request.post("/api/demo/login-as", { data: { userId: "p02" } });

  await gotoReady(a, "/chats/chat-dm-p02");
  await gotoReady(b, "/chats/chat-dm-p02");
  await expect(a.getByTestId("chat-thread")).toBeVisible();
  await expect(b.getByTestId("chat-thread")).toBeVisible();
  await a.waitForTimeout(500); // let both SSE streams connect

  await a.getByTestId("composer").fill("are you coming saturday?");
  await a.getByTestId("send").click();
  await expect(b.getByTestId("messages")).toContainText("are you coming saturday?");

  await b.getByTestId("composer").fill("yes!! see you there");
  await b.getByTestId("send").click();
  await expect(a.getByTestId("messages")).toContainText("yes!! see you there");
});

test("buffered stream (e.g. a tunnel that holds SSE): phones fall back to polling and still get messages", async ({ browser }) => {
  // Hold /api/stream open forever without delivering a byte — what we measured through a Cloudflare quick tunnel.
  const stall = async (ctx: import("@playwright/test").BrowserContext) => ctx.route("**/api/stream*", () => new Promise(() => {}));
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  await stall(ctxA);
  await stall(ctxB);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await b.request.post("/api/demo/login-as", { data: { userId: "p02" } });

  await gotoReady(a, "/chats/chat-dm-p02");
  await gotoReady(b, "/chats/chat-dm-p02");
  await expect(a.locator("html")).toHaveAttribute("data-live", "polling", { timeout: 8_000 });
  await expect(b.locator("html")).toHaveAttribute("data-live", "polling", { timeout: 8_000 });

  await a.getByTestId("composer").fill("tunnel test: are you there?");
  await a.getByTestId("send").click();
  await expect(b.getByTestId("messages")).toContainText("tunnel test: are you there?", { timeout: 8_000 });
  await b.getByTestId("composer").fill("yep, via polling");
  await b.getByTestId("send").click();
  await expect(a.getByTestId("messages")).toContainText("yep, via polling", { timeout: 8_000 });
  await ctxA.close();
  await ctxB.close();
});

test("healthy stream stays in streaming mode (no polling)", async ({ page }) => {
  await gotoReady(page, "/chats/chat-dm-p02");
  await expect(page.locator("html")).toHaveAttribute("data-live", "stream");
  await page.waitForTimeout(6_000); // past the hello timeout and one ping
  await expect(page.locator("html")).toHaveAttribute("data-live", "stream");
});
