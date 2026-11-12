import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { flag, setFlagOverride } from "@/lib/flags";
import { connectScreen } from "@/lib/server/phones";
import { runPreflight } from "@/lib/server/preflight";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const byId = (r: Awaited<ReturnType<typeof runPreflight>>) => Object.fromEntries(r.checks.map((c) => [c.id, c]));

describe("preflight (F25)", () => {
  let off: () => void = () => {};
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
    resetModelSettings();
  });
  afterEach(() => {
    off();
    setFlagOverride("SECRET_PANEL", null);
    resetModelSettings();
  });

  it("is on by default", () => expect(flag("PREFLIGHT")).toBe(true));

  it("on a clean server with the projector open: ready, and the rehearsal locks the market with all checks green", async () => {
    off = connectScreen("stage");
    const r = await runPreflight();
    const c = byId(r);
    expect(r.ready).toBe(true);
    expect(r.checks.map((x) => x.id)).toEqual(["flags", "model", "pace", "rehearsal", "privacy", "live", "screens", "fallbacks"]);
    expect(r.checks.every((x) => x.status === "ok")).toBe(true);
    expect(c.rehearsal!.detail).toMatch(/^Dolores Night Market locked by five signatures in \d+ ms; MATCH FOUND to all five; 20 cards; 5 openers\.$/);
    expect(c.privacy!.detail).toMatch(/^What the party knows: nothing, for all five\. \d+ prompts, own brief only\. The leak test is blocked\.$/);
    expect(c.model!.detail).toMatch(/^Mock model \(no key\)/);
  });

  it("changes nothing live: the rehearsal runs in its own store", async () => {
    const s = store();
    const before = { version: s.version, parties: s.parties.size, queue: s.queue.length, events: s.events_log.length, traces: s.traces.length };
    await runPreflight();
    expect({ version: s.version, parties: s.parties.size, queue: s.queue.length, events: s.events_log.length, traces: s.traces.length }).toEqual(before);
  });

  it("says what to fix: a layer switched off fails; no projector, a party mid-talk and a forced timeout are notes", async () => {
    setFlagOverride("SECRET_PANEL", false);
    setModelSettings({ timeoutAgent: "kai" });
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const r = await runPreflight();
    const c = byId(r);
    expect(r.ready).toBe(false);
    expect(c.flags).toMatchObject({ status: "fail", detail: expect.stringContaining("Off: SECRET_PANEL") });
    expect(c.pace).toMatchObject({ status: "warn", detail: expect.stringContaining("Kai's agent is set to time out") });
    expect(c.live).toMatchObject({ status: "warn", detail: expect.stringContaining("A party is talking right now") });
    expect(c.screens).toMatchObject({ status: "warn", detail: expect.stringContaining("Open /stage on the projector") });
  });
});
