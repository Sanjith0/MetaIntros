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
