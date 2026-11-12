import { expect, test } from "@playwright/test";
import { lockedParty } from "./helpers";

/* F8: leave before the lock without attribution; I'm here pings; the chat closes after the event. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

test("leaving before the lock: the others are told the party changed, never who left", async ({ browser, baseURL, request }) => {
  test.setTimeout(120_000);
  try {
    await request.post("/api/demo/reset");
    await request.post("/api/demo/settings", { data: { paceMs: 1400 } }); // a slow talk, so there is time to leave
    await request.post("/api/demo/start", { data: { mode: "all" } });

    const devCtx = await browser.newContext(PHONE);
    await devCtx.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
    const dev = await devCtx.newPage();
    await dev.goto("/party");
    await expect(dev.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await expect(dev.getByTestId("party-status")).toHaveText("Your agents are talking");

    const kaiCtx = await browser.newContext(PHONE);
    await kaiCtx.addCookies([{ name: "pq_viewer", value: "kai", url: baseURL! }]);
    const kai = await kaiCtx.newPage();
    await kai.goto("/party");
    await kai.getByTestId("leave-party").tap();
    await expect(kai.getByTestId("leave-confirm")).toContainText("They won't be told who left");
    await kai.getByTestId("leave-yes").tap();
    await expect(kai.getByTestId("no-party-title")).toHaveText("You left the party");
    await kai.screenshot({ path: "shots/f8-kai-left.png", animations: "disabled" });

    const toast = dev.getByTestId("toast");
    await expect(toast).toContainText("Your party changed before the plan was set");
    await expect(toast).toContainText("Nobody was named");
    await expect(toast).not.toContainText("Kai");
    await expect(dev.getByTestId("no-party-title")).toHaveText("You're in the queue");
    await dev.screenshot({ path: "shots/f8-dev-notice.png", animations: "disabled" });
    await Promise.all([devCtx.close(), kaiCtx.close()]);
  } finally {
    await request.delete("/api/demo/settings");
  }
});

test("party chat: I'm here pings, and the chat closes after the event", async ({ browser, baseURL, request }) => {
  test.setTimeout(150_000);
  try {
    await lockedParty(request);
    const party = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { chatId: string } } };
    const chat = `/chat/${party.view.party.chatId}`;

    const devCtx = await browser.newContext(PHONE);
    await devCtx.addCookies([{ name: "pq_viewer", value: "dev", url: baseURL! }]);
    const dev = await devCtx.newPage();
    await dev.goto(chat);
    await expect(dev.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await expect(dev.getByTestId("chat-expiry")).toContainText("closes Sun 10 AM");

    const mayaCtx = await browser.newContext(PHONE);
    await mayaCtx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    const maya = await mayaCtx.newPage();
    await maya.goto(chat);
    await expect(maya.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await maya.getByTestId("chat-im-here").tap();
    await expect(maya.getByTestId("chat-im-here")).toHaveCount(0);
    await expect(dev.getByTestId("message-list")).toContainText("Maya is here.");
    await dev.screenshot({ path: "shots/f8-chat-here.png", animations: "disabled" });

    // The demo clock jumps past the event: the chat closes and its messages are gone.
    await request.post("/api/demo/clock", { data: { to: "after-event" } });
    await maya.goto(chat);
    await expect(maya.getByTestId("chat-expired")).toContainText("This chat closed after the event");
    await expect(maya.getByTestId("message-list")).toHaveCount(0);
    const post = await request.post(`/api/chat/${party.view.party.chatId}/messages`, { data: { text: "hello?" }, headers: { cookie: "pq_viewer=maya" } });
    expect(post.status()).toBe(403);
    await maya.screenshot({ path: "shots/f8-chat-expired.png", animations: "disabled" });
    await Promise.all([devCtx.close(), mayaCtx.close()]);
  } finally {
    await request.post("/api/demo/clock", { data: { to: "now" } });
  }
});
