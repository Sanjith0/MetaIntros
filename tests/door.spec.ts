import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";

/* M5 proof: posting the fixture frame shows Dev's card on Maya's /door. */

export async function lockedParty(request: APIRequestContext): Promise<string> {
  await request.post("/api/demo/reset");
  const start = await request.post("/api/demo/start", { data: { mode: "all" } });
  const { partyId } = (await start.json()) as { partyId: string };
  await expect
    .poll(
      async () => {
        const r = await request.get("/api/party", { headers: { cookie: "pq_viewer=maya" } });
        return ((await r.json()) as { view: { party: { status: string } } | null }).view?.party.status;
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toBe("locked");
  return partyId;
}

test("door: the fixture frame shows Dev's card on Maya's /door", async ({ page, context, baseURL, request }) => {
  test.setTimeout(150_000);
  const partyId = await lockedParty(request);
  await context.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
  await page.goto("/door");
  await expect(page.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId("im-here").click();
  await expect(page.getByTestId("im-here")).toContainText("You're here");

  const frame = JSON.parse(fs.readFileSync("fixtures/frames/dev-at-door.json", "utf8"));
  const res = await request.post("/api/frames", { data: { ...frame, partyId } });
  expect(res.ok()).toBeTruthy();
  const spotted = await res.json();
  console.log("POST /api/frames ->", JSON.stringify(spotted));
  expect(spotted).toMatchObject({ viewerId: "maya", subjectId: "dev", method: "stub" });

  await expect(page.getByTestId("door-card-name")).toHaveText("Dev");
  await expect(page.getByTestId("door-card-opener")).toContainText("Dev,");
  await page.screenshot({ path: "shots/m5-door.png", animations: "disabled" });

  // Tap a face without the camera.
  await page.getByTestId("tap-zoe").click();
  await expect(page.getByTestId("door-card-name")).toHaveText("Zoe");
});
