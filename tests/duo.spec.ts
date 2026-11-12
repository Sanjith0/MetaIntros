import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F6: Zoe brings her friend Sam; both land in the same party. Women's settings in the sheet. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("duo queue: Zoe invites Sam, both land in one party; women's settings in the sheet", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");
  for (const id of ["dev", "ana", "kai"]) {
    const r = await request.post("/api/queue/join", {
      data: { eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences[id], consentBridges: true },
      headers: { cookie: `pq_viewer=${id}` },
    });
    expect(r.ok()).toBeTruthy();
  }

  // Zoe: women's settings show; she brings Sam.
  const zoeCtx = await browser.newContext(PHONE);
  await zoeCtx.addCookies([{ name: "pq_viewer", value: "zoe", url: baseURL! }]);
  const zoe = await zoeCtx.newPage();
  await zoe.goto(`/queue?event=${DEMO_PARTY.entryEventId}`);
  await expect(zoe.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await expect(zoe.getByTestId("women-settings")).toBeVisible();
  await zoe.getByTestId("sentence").fill(DEMO_PARTY.sentences.zoe!);
  await expect(zoe.getByTestId("brief-preview")).toBeVisible();
  await zoe.getByTestId("duo-select").selectOption("sam");
  await zoe.getByTestId("not-only-woman").check();
  await zoe.getByTestId("duo-select").scrollIntoViewIfNeeded();
  await zoe.screenshot({ path: "shots/f6-zoe-sheet.png", animations: "disabled" });
  await zoe.getByTestId("join-queue").tap();
  await expect(zoe.getByTestId("queue-duo")).toHaveText("Waiting for Sam to join you");

  // Sam: gets the invite as a toast, opens it, joins with his own sentence.
  const samCtx = await browser.newContext(PHONE);
  await samCtx.addCookies([{ name: "pq_viewer", value: "sam", url: baseURL! }]);
  const sam = await samCtx.newPage();
  await sam.goto("/events");
  await expect(sam.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  // The invite went out before Sam opened the app, so he opens the link it carries (the live toast is the next test).
  await sam.goto(`/queue?event=${DEMO_PARTY.entryEventId}&duo=zoe`);
  await expect(sam.getByTestId("duo-invite")).toContainText("Zoe asked to queue with you");
  await expect(sam.getByTestId("women-settings")).toHaveCount(0);
  await expect(sam.getByTestId("duo-select")).toHaveValue("zoe");
  await sam.getByTestId("sentence").fill("podcasts and a walk, home by eleven");
  await expect(sam.getByTestId("brief-preview")).toBeVisible();
  await sam.screenshot({ path: "shots/f6-sam-invite.png", animations: "disabled" });
  await sam.getByTestId("join-queue").tap();

  // Both see MATCH FOUND, and their cards say they queued together.
  await expect(zoe.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });
  await expect(sam.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });
  await zoe.goto("/party");
  await expect(zoe.getByTestId("party-members")).toContainText("You queued together.");
  await zoe.getByTestId("party-members").scrollIntoViewIfNeeded();
  await zoe.screenshot({ path: "shots/f6-zoe-party.png", animations: "disabled" });
  await Promise.all([zoeCtx.close(), samCtx.close()]);
});

test("duo queue: the invite arrives as a live toast", async ({ browser, baseURL, request }) => {
  await request.post("/api/demo/reset");
  const samCtx = await browser.newContext(PHONE);
  await samCtx.addCookies([{ name: "pq_viewer", value: "sam", url: baseURL! }]);
  const sam = await samCtx.newPage();
  await sam.goto("/events");
  await expect(sam.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await request.post("/api/queue/join", {
    data: { eventId: DEMO_PARTY.entryEventId, sentence: DEMO_PARTY.sentences.zoe, consentBridges: true, duoWith: "sam" },
    headers: { cookie: "pq_viewer=zoe" },
  });
  const toast = sam.getByTestId("toast");
  await expect(toast).toContainText("Zoe wants to queue with you");
  await toast.getByRole("link", { name: "Open" }).tap();
  await expect(sam.getByTestId("duo-invite")).toBeVisible();
  await samCtx.close();
});
