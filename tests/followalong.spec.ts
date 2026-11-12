import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F46: a phone in the room follows along at /stage?screen=room. Everything it receives (page, API, live stream) is sanitized on the server. */

const WORDS = [
  "Maya", "Dev", "Ana", "Kai", "Zoe",
  ...Object.values(DEMO_PARTY.sentences),
  "out by eleven", "under twenty bucks", "nowhere I have to drink", "spending up to 40", "home by midnight", "nothing too loud", "budget around 25",
  "About me", "I'm in", "Happy to go with the group",
];

test("follow along: the room's phone gets nothing personal, from the page, the API or the live stream", async ({ browser, page, request }) => {
  test.setTimeout(150_000);
  await request.post("/api/demo/reset");

  // The projector, in public mode, shows the QR.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/stage?screen=public");
  await expect(page.getByTestId("follow-qr")).toBeVisible();
  await expect(page.getByTestId("follow-url")).toContainText("/stage?screen=room");

  // A phone in the room opens the room view and records its live stream while the party runs.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const phone = await ctx.newPage();
  await phone.goto("/stage?screen=room");
  await expect(phone.getByTestId("public-toggle")).toHaveCount(0);
  await expect(phone.getByTestId("leak-open")).toHaveCount(0);
  await expect(phone.getByTestId("stage-start")).toHaveCount(0); // no operator controls in the room
  const recorded = phone.evaluate(
    () =>
      new Promise<{ traces: string[]; events: number }>((resolve) => {
        const es = new EventSource("/api/stream?stage=public");
        const traces: string[] = [];
        let events = 0;
        es.addEventListener("trace", (e) => traces.push((e as MessageEvent).data));
        es.addEventListener("pq", () => events++);
        const check = setInterval(() => {
          if (traces.some((t) => t.includes('"kind":"locked"'))) {
            clearInterval(check);
            setTimeout(() => {
              es.close();
              resolve({ traces, events });
            }, 500);
          }
        }, 200);
      }),
  );
  await page.waitForTimeout(500);
  await page.getByTestId("stage-start").click();
  const stream = await recorded;
  expect(stream.events).toBe(0); // no bus events at all, only sanitized traces
  expect(stream.traces.length).toBeGreaterThan(10);
  const streamed = stream.traces.join("\n");
  for (const w of WORDS) expect(streamed, `stream: ${w}`).not.toContain(w);

  // Its page and its API: the same.
  await expect(phone.getByTestId("stage-status")).toHaveText("Locked", { timeout: 30_000 });
  await expect(phone.getByTestId("signature-count")).toHaveText("5 of 5 signed");
  const text = await phone.getByTestId("stage").innerText();
  for (const w of WORDS) expect(text, `page: ${w}`).not.toContain(w);
  const api = await (await request.get("/api/stage?public=1")).text();
  for (const w of WORDS) expect(api, `api: ${w}`).not.toContain(w);
  await phone.screenshot({ path: "shots/f46-room-phone.png" });
  await page.screenshot({ path: "shots/f46-projector-qr.png", animations: "disabled" });
  await ctx.close();
});
