import { expect, test } from "@playwright/test";
import { gotoReady, resetDemo, trackConsoleErrors, lockIn } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const PNG_URL = `data:image/png;base64,${PNG.toString("base64")}`;

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("squad album → AI-suggested post on Home → story; album stays squad-only", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const errors = trackConsoleErrors(page);
  await gotoReady(page, "/queue/start?eventId=ev-indie-guild");
  await page.getByTestId("size-4").click();
  await page.getByTestId("choose-area").click();
  await page.getByTestId("area-lm-downtown-pa").click();
  await lockIn(page);
  const status = await (await page.request.get("/api/queue/status")).json();
  const partyId: string = status.partyId;
  const party = await (await page.request.get(`/api/party/${partyId}`)).json();
  const mateId: string = party.members.map((m: { userId: string }) => m.userId).find((u: string) => u !== "p01");

  // Squad info → album: add two photos, then turn one photo's post consent off
  await gotoReady(page, `/squad/${partyId}`);
  await page.getByTestId("open-album").click();
  await expect(page.getByTestId("squad-album")).toBeVisible();
  await expect(page.getByTestId("album-empty")).toBeVisible();
  await page.getByTestId("album-input").setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: PNG },
    { name: "b.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByTestId("album-photo")).toHaveCount(2);
  await page.getByTestId("album-photo").first().click();
  await expect(page.getByTestId("album-photo-sheet")).toBeVisible();
  await page.getByTestId("photo-shareable").click();
  await expect(page.getByTestId("photo-shareable")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-testid="album-photo"][data-shareable="false"]')).toHaveCount(1);

  // A squadmate adds a photo from their phone; it shows up live. Outsiders get 404 for everything.
  const mate = await (await browser.newContext()).newPage();
  await mate.request.post("/api/demo/login-as", { data: { userId: mateId } });
  expect((await mate.request.post(`/api/squad/${partyId}/album`, { data: { dataUrl: PNG_URL, caption: "Front row" } })).ok()).toBe(true);
  await expect(page.getByTestId("album-photo")).toHaveCount(3, { timeout: 15_000 });
  const album = await (await page.request.get(`/api/squad/${partyId}/album`)).json();
  const outsider = await (await browser.newContext()).newPage();
  await outsider.request.post("/api/demo/login-as", { data: { userId: "p09" } }); // not in the squad (Jordan blocked them)
  expect((await outsider.request.get(`/api/squad/${partyId}/album`)).status()).toBe(404);
  expect((await outsider.request.get(album.photos[0].url)).status()).toBe(404);
  expect((await page.request.get(album.photos[0].url)).status()).toBe(200);

  // The event ends → the status card offers sharing as the second action, squad info as its primary
  await page.request.post("/api/demo/fast-forward");
  await gotoReady(page, "/events");
  await expect(page.getByTestId("status-secondary")).toHaveText("Share the outing");
  await gotoReady(page, `/squad/${partyId}`);
  await page.getByTestId("open-share").click();
  await expect(page.getByTestId("share-outing")).toBeVisible();

  // Let AI suggest a post: offline here, so the template is used and labeled as such
  await page.getByTestId("share-ai").click();
  await expect(page.getByTestId("post-composer")).toBeVisible();
  await expect(page.getByTestId("ai-source")).toHaveAttribute("data-source", "fallback");
  await expect(page.getByTestId("ai-source")).toContainText("Template (AI unavailable)");
  await expect(page.getByTestId("composer-selected-photo")).toHaveCount(3); // 2 own (always allowed) + the squadmate's
  await page.getByTestId("composer-remove-photo").first().click();
  await expect(page.getByTestId("composer-selected-photo")).toHaveCount(2);
  await page.getByTestId("composer-caption").fill("Indie Night with my Link squad. Great first show.");
  await expect(page.getByTestId("composer-edited")).toBeVisible();
  await page.getByTestId("composer-share").click();
  await expect(page.getByTestId("share-done")).toBeVisible();
  await page.getByTestId("share-see-home").click();

  // Home: the real post leads the feed, with its photos and an honest caption label
  const post = page.getByTestId("real-post").first();
  await expect(post).toContainText("Great first show.");
  await expect(post).toContainText("with their Link squad");
  await expect(post.getByTestId("post-photo")).toHaveCount(2);
  await expect(post.getByTestId("caption-source")).toContainText("edited by the author");
  const postId = (await post.getAttribute("id"))!.replace("post-", "");
  const photoSrc = (await post.getByTestId("post-photo").first().getAttribute("src"))!;
  expect(photoSrc).toContain(`/api/posts/${postId}/photos/`);
  expect((await page.request.get(photoSrc)).status()).toBe(200);
  expect((await outsider.request.get(photoSrc)).status()).toBe(404); // blocked, and not a friend

  // The prompt stops showing once you've shared
  await gotoReady(page, `/squad/${partyId}`);
  await expect(page.getByTestId("share-prompt")).toHaveCount(0);

  // Create story from Home with an album photo → it leads the rail and opens full screen
  await gotoReady(page, "/home");
  await page.getByTestId("create-story").click();
  await expect(page.getByTestId("home-composer-sheet")).toBeVisible();
  await page.getByTestId("composer-photo").first().click();
  await page.getByTestId("composer-share").click();
  await expect(page.getByTestId("home-composer-sheet")).toHaveCount(0);
  await expect(page.getByTestId("story-tile")).toHaveCount(1);
  await page.getByTestId("story-tile").click();
  await expect(page.getByTestId("story-viewer")).toBeVisible();
  await expect(page.getByTestId("story-photo")).toBeVisible();
  await page.getByTestId("story-next").click(); // single frame → advancing closes it
  await expect(page.getByTestId("story-viewer")).toHaveCount(0);
  await page.getByTestId("story-tile").click();
  await page.getByTestId("story-close").click();
  await expect(page.getByTestId("story-viewer")).toHaveCount(0);

  // A squadmate chooses not to post: remembered, nobody else is affected
  await gotoReady(mate, `/squad/${partyId}/share`);
  await mate.getByTestId("share-none").click();
  await expect(mate.getByTestId("share-declined")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors.filter((e) => !e.includes("404"))).toEqual([]);
});
