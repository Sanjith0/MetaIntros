import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { DEMO_PARTY } from "../fixtures/demo";

/* Records shots/demo.webm: about 60 seconds of the demo path from Maya's phone.
 * Run: npx playwright test tests/demo-video.spec.ts */

const TARGET_MS = 60_000;

test("record the 60-second demo path", async ({ browser, baseURL, request }) => {
  test.setTimeout(180_000);
  await request.post("/api/demo/reset");
  await request.post("/api/demo/settings", { data: { paceMs: 650 } }); // a watchable pace on the production server
  await request.post("/api/demo/start", { data: { mode: "four" } }); // Dev, Ana, Kai, Zoe already queued

  fs.mkdirSync("test-results/video", { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: "test-results/video", size: { width: 1280, height: 720 } } });
  await ctx.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const mark = (label: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${label}`);

  // 1. The Events tab, then the event Maya cares about.
  await page.goto("/events");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  mark("events tab");
  await page.waitForTimeout(4000);
  await page.getByTestId(`event-card-${DEMO_PARTY.entryEventId}`).getByRole("link", { name: "Rooftop Sunset Session", exact: true }).click();
  await expect(page.getByTestId("find-my-party")).toBeVisible();
  mark("event page");
  await page.waitForTimeout(4000);

  // 2. Find my party: one sentence, a private preview, join.
  await page.getByTestId("find-my-party").click();
  await expect(page.getByTestId("sentence")).toBeVisible();
  await page.getByTestId("sentence").pressSequentially(DEMO_PARTY.sentences.maya!, { delay: 35 });
  await expect(page.getByTestId("brief-preview")).toBeVisible();
  mark("sentence typed, private preview");
  await page.waitForTimeout(5000);
  await page.getByTestId("join-queue").click();
  await expect(page.getByTestId("party-forming")).toBeVisible({ timeout: 15_000 });
  mark("party forming");
  await page.waitForTimeout(1500);

  // 3. Watch the table fill in live until code locks the plan.
  await page.getByRole("link", { name: "Watch your party" }).click();
  await expect(page.getByTestId("party-table")).toBeVisible();
  mark("watching the table");
  await page.getByTestId("party-table").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("match-found")).toBeVisible({ timeout: 90_000 });
  mark("MATCH FOUND");
  await page.waitForTimeout(5000);

  // 4. The group chat: plan pinned, one opener each.
  await page.getByRole("link", { name: "Open group chat" }).click();
  await expect(page.getByTestId("opener-message")).toHaveCount(5);
  mark("group chat");
  await page.waitForTimeout(5000);

  // 5. The party card, then Maya's secret: her rules on her phone, and what the party knows (nothing).
  await page.goto("/party");
  await expect(page.getByTestId("party-card")).toBeVisible();
  mark("party card");
  await page.waitForTimeout(2500);
  await page.getByTestId("secret-panel").scrollIntoViewIfNeeded();
  mark("Maya's secret");
  await page.waitForTimeout(3500);

  // 6. The Event page now shows the RSVP: your party, 5 going.
  await page.goto(`/event/${DEMO_PARTY.expectedPlanEventId}`);
  await expect(page.getByTestId("party-rsvp-banner")).toBeVisible();
  mark("event RSVP");
  await page.waitForTimeout(4000);

  // 7. At the door: the camera stub spots Dev; his card says what to say.
  await page.goto("/door");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("im-here").click();
  const party = (await (await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } })).json()) as { view: { party: { id: string } } };
  const frame = JSON.parse(fs.readFileSync("fixtures/frames/dev-at-door.json", "utf8"));
  await request.post("/api/frames", { data: { ...frame, partyId: party.view.party.id } });
  await expect(page.getByTestId("door-card-name")).toHaveText("Dev");
  mark("door card");
  await page.waitForTimeout(5000);

  // 8. Afterwards: private picks, mutual pairs only.
  await request.post("/api/runitback", { data: { partyId: party.view.party.id, pickedIds: ["maya"] }, headers: { cookie: "pq_viewer=dev" } });
  await page.goto("/runitback");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("pick-dev").click();
  await page.waitForTimeout(800);
  await page.getByTestId("save-picks").click();
  await expect(page.getByTestId("mutual-dev")).toBeVisible();
  mark("run it back");

  const left = TARGET_MS - (Date.now() - t0);
  if (left > 0) await page.waitForTimeout(left);
  mark("end");

  await request.delete("/api/demo/settings");
  const video = page.video()!;
  await ctx.close();
  fs.mkdirSync("shots", { recursive: true });
  await video.saveAs("shots/demo.webm");
  const total = (Date.now() - t0) / 1000;
  console.log(`saved shots/demo.webm (${fs.statSync("shots/demo.webm").size} bytes, about ${Math.round(total)} s)`);
});
