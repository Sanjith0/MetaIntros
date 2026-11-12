import { expect, test } from "@playwright/test";
import { gotoReady, resetDemo } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.beforeEach(async ({ request }) => {
  await resetDemo(request);
  await request.post("/api/demo/settings", { data: { fillMode: "simulated", simFillMs: 1500 } });
});

test("check-ins sync across members; party photos visible only inside the party", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage(); // Me
  await gotoReady(a, "/queue/start?eventId=ev-indie-guild");
  await a.getByTestId("size-3").click();
  await a.getByTestId("choose-area").click();
  await a.getByTestId("area-lm-downtown-pa").click();
  await expect(a.getByTestId("party-found")).toBeVisible({ timeout: 30_000 });
  const status = await (await a.request.get("/api/queue/status")).json();
  const party = await (await a.request.get(`/api/party/${status.partyId}`)).json();
  const mateId = party.members.map((m: { userId: string }) => m.userId).find((u: string) => u !== "p01");

  const b = await (await browser.newContext()).newPage(); // a squadmate's phone
  await b.request.post("/api/demo/login-as", { data: { userId: mateId } });
  await gotoReady(b, `/chats/${party.chat.id}`);
  await gotoReady(a, `/chats/${party.chat.id}`);
  await expect(b.getByTestId("arrival-count")).toHaveText("0/3 here");
  await expect(a.getByTestId("meeting-pin")).toContainText("The Guild Theatre");

  await a.getByTestId("im-here").click();
  await expect(b.getByTestId("arrival-count")).toHaveText(/[1-3]\/3 here/); // live update on another phone

  await b.getByTestId("photo-input").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(a.locator(`[data-testid="arrival-list"] img`)).toHaveCount(1);
  expect((await a.request.get(`/api/party/${party.id}/photo/${mateId}`)).status()).toBe(200);

  const outsider = await (await browser.newContext()).newPage();
  await outsider.request.post("/api/demo/login-as", { data: { userId: "p66" } });
  expect((await outsider.request.get(`/api/party/${party.id}/photo/${mateId}`)).status()).toBe(404);
  expect((await outsider.request.get(`/api/party/${party.id}`)).status()).toBe(404);
});
