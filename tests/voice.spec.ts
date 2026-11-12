import { expect, test } from "@playwright/test";
import { DEMO_PARTY } from "../fixtures/demo";

/* F16: say your sentence instead of typing it. Off by default; typing always works. */

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// A stand-in recognizer: real speech can't be spoken into a test browser.
const fakeSpeech = (text: string) => `
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { setTimeout(() => { this.onresult && this.onresult({ results: [[{ transcript: ${JSON.stringify(text)} }]] }); this.onend && this.onend(); }, 150); }
    stop() { this.onend && this.onend(); }
  };`;

test("voice: off by default; when on, the spoken sentence fills the box and the brief", async ({ browser, baseURL, request }) => {
  await request.post("/api/demo/reset");
  try {
    // Off by default: no voice button.
    const off = await browser.newContext(PHONE);
    await off.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    await off.addInitScript(fakeSpeech("anything"));
    const p0 = await off.newPage();
    await p0.goto(`/queue?event=${DEMO_PARTY.entryEventId}`);
    await expect(p0.getByTestId("sentence")).toBeVisible();
    await expect(p0.getByTestId("voice-button")).toHaveCount(0);
    await off.close();

    // Turned on from /demo's layers: say it instead.
    await request.post("/api/demo/flags", { data: { name: "VOICE_SENTENCE", value: true } });
    const on = await browser.newContext(PHONE);
    await on.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    await on.addInitScript(fakeSpeech(DEMO_PARTY.sentences.maya!));
    const p = await on.newPage();
    await p.goto(`/queue?event=${DEMO_PARTY.entryEventId}`);
    await expect(p.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await expect(p.getByTestId("voice")).toContainText("Typing always works");
    await p.getByTestId("voice-button").tap();
    await expect(p.getByTestId("sentence")).toHaveValue(DEMO_PARTY.sentences.maya!);
    await expect(p.getByTestId("brief-preview")).toContainText("No drink minimum");
    await p.screenshot({ path: "shots/f16-voice.png", animations: "disabled" });
    await on.close();

    // A browser that can't do speech: no button, and typing still works.
    const none = await browser.newContext(PHONE);
    await none.addCookies([{ name: "pq_viewer", value: "maya", url: baseURL! }]);
    await none.addInitScript("delete window.webkitSpeechRecognition; delete window.SpeechRecognition;");
    const p2 = await none.newPage();
    await p2.goto(`/queue?event=${DEMO_PARTY.entryEventId}`);
    await expect(p2.locator("[data-live=on]")).toHaveCount(1, { timeout: 30_000 });
    await expect(p2.getByTestId("voice-button")).toHaveCount(0);
    await p2.getByTestId("sentence").fill("home by 10, sober night please");
    await expect(p2.getByTestId("brief-preview")).toContainText("Done by 10 PM");
    await none.close();
  } finally {
    await request.post("/api/demo/flags", { data: { name: "VOICE_SENTENCE", value: null } });
  }
});
