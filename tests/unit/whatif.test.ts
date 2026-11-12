import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { whatIf, whatIfMembers } from "@/lib/server/whatif";
import { removedLabel } from "@/lib/stage/whatif";
import { callModel, withMockModel } from "@/model/client";

async function locked() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}
const rule = (pid: string, ownerId: string, label: string) => ({ ownerId, ruleId: whatIfMembers(pid).find((m) => m.id === ownerId)!.rules.find((r) => r.label === label)!.id });

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("what if (F21)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("WHAT_IF")).toBe(true));

  it("lists each member's removable rules (never the public-place safety rule)", async () => {
    const pid = await locked();
    const ms = whatIfMembers(pid);
    expect(ms.map((m) => m.id).sort()).toEqual(["ana", "dev", "kai", "maya", "zoe"]);
    expect(ms.find((m) => m.id === "maya")!.rules.map((r) => r.label)).toEqual(["Done by 11 PM", "$20 or less", "No drink minimum"]);
    for (const m of ms) for (const r of m.rules) expect(r.label).not.toBe("Public place only");
  });

  it("without Maya's drink rule, the rooftop opens and the market still locks; the live party is untouched", async () => {
    const pid = await locked();
    const s = store();
    const snap = () => ({ version: s.version, events: s.events_log.length, table: s.table.length, party: JSON.stringify(s.parties.get(pid)), maya: JSON.stringify(s.briefs.get("brief-maya")) });
    const before = snap();
    const traces = s.traces.length;
    const r = await whatIf(pid, [rule(pid, "maya", "No drink minimum")]);
    if (!r.ok) throw new Error(r.error);
    expect(r.live).toEqual({ locked: "Dolores Night Market", lockedBy: "signatures", unavailable: ["Rooftop Sunset Session", "Late Synth Showcase", "Chef's Counter Supper"] });
    expect(r.sandbox.locked).toBe("Dolores Night Market");
    expect(r.opened).toEqual(["Rooftop Sunset Session"]);
    expect(r.changed).toBe(false);
    // Live state: same store, same party, Maya still has her rule, no events; one projector trace.
    expect(snap()).toEqual(before);
    expect(s.traces.length).toBe(traces + 1);
    expect(s.traces.at(-1)).toMatchObject({ lane: "private", meta: { kind: "whatif" }, title: "What if · without Maya's “No drink minimum”" });
  });

  it("the late show needs both curfews gone: with them and the drink rule, two plans open", async () => {
    const pid = await locked();
    const r = await whatIf(pid, [rule(pid, "maya", "Done by 11 PM"), rule(pid, "ana", "Done by 12 AM"), rule(pid, "maya", "No drink minimum")]);
    if (!r.ok) throw new Error(r.error);
    expect(r.opened).toEqual(["Rooftop Sunset Session", "Late Synth Showcase"]);
    expect(r.sandbox.unavailable).toEqual(["Chef's Counter Supper"]);
    expect(removedLabel(r.removed)).toBe("Maya's “Done by 11 PM”, Ana's “Done by 12 AM” and Maya's “No drink minimum”");
    // Just one curfew is not enough.
    const one = await whatIf(pid, [rule(pid, "maya", "Done by 11 PM")]);
    expect(one.ok && one.opened).toEqual([]);
  });

  it("refuses before the lock, unknown rules, the safety rule, and more than five", async () => {
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const early = [...store().parties.keys()][0]!;
    expect(await whatIf(early, [{ ownerId: "maya", ruleId: "x" }])).toMatchObject({ ok: false, error: "Run it after the party locks." });
    const pid = await locked();
    expect(await whatIf(pid, [])).toMatchObject({ ok: false });
    expect(await whatIf(pid, [{ ownerId: "maya", ruleId: "nope" }])).toMatchObject({ ok: false, error: "No such rule." });
    expect(await whatIf(pid, [{ ownerId: "priya", ruleId: rule(pid, "maya", "$20 or less").ruleId }])).toMatchObject({ ok: false, error: "No such rule." });
    const pub = store().briefs.get("brief-maya")!.hardRules.find((r) => r.kind === "public_venue");
    if (pub) expect(await whatIf(pid, [{ ownerId: "maya", ruleId: pub.id }])).toMatchObject({ ok: false });
    expect(await whatIf(pid, Array.from({ length: 6 }, () => rule(pid, "maya", "$20 or less")))).toMatchObject({ ok: false });
  });

  it("a sandbox run never spends a real model call, even with a key set", async () => {
    process.env.MOCK_MODEL = "0";
    process.env.META_API_KEY = "test-key-not-real";
    process.env.META_API_BASE_URL = "http://127.0.0.1:9/v1"; // nothing listens here
    const counter = path.join(os.tmpdir(), `pq-whatif-${process.pid}.json`);
    process.env.MODEL_COUNTER_FILE = counter;
    fs.rmSync(counter, { force: true });
    const r = await withMockModel(() => callModel({ role: "spark", task: "t", system: "s", user: "u", schema: z.object({ a: z.number() }), mock: () => ({ a: 1 }), fallback: () => ({ a: 2 }) }));
    expect(r).toMatchObject({ value: { a: 1 }, source: "mock" });
    expect(fs.existsSync(counter)).toBe(false);
  });
});
