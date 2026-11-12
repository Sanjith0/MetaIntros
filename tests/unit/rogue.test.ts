import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { ownerChecks } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { runPreflight } from "@/lib/server/preflight";
import { joinQueue } from "@/lib/server/queue";
import { secretView } from "@/lib/server/secret";
import { resetStore, store } from "@/lib/server/store";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("rogue model (F27)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetModelSettings();
  });
  afterEach(() => resetModelSettings());

  it("the switch is there, and off by default", () => {
    expect(flag("ROGUE_MODE")).toBe(true);
    expect(store() && resetModelSettings().rogue).toBe(false);
  });

  it("with every agent accepting everything and trying to leak, code still locks a plan that passes all five rules and nothing leaks", async () => {
    setModelSettings({ rogue: true });
    const pid = await locked();
    const s = store();
    const party = s.parties.get(pid)!;
    expect(party.status).toBe("locked");
    const plan = s.plans.get(party.planId!)!;
    for (const id of FIVE) expect(ownerChecks(pid, plan, s.briefs.get(`brief-${id}`)!).every((c) => c.pass), id).toBe(true);
    // Code overrode every yes to a plan that breaks someone's rule: 6 in the demo party (Maya 3, Dev, Ana, Zoe 1 each),
    // and the verifier blocked every leak attempt.
    expect(s.verdicts.filter((v) => v.partyId === pid && v.overriddenByCode).length).toBe(6);
    expect(s.blockedLines.filter((b) => b.partyId === pid).length).toBeGreaterThanOrEqual(5);
    for (const t of s.table.filter((x) => x.partyId === pid)) expect(t.text).not.toMatch(/my person said|For the record/);
    for (const id of FIVE) expect(secretView(pid, id)!.partyKnows).toEqual([]);
    expect(s.traces.some((t) => t.meta?.kind === "rogue" && t.lane === "private")).toBe(true);
  });

  it("switched off, agents behave and nothing is overridden or blocked", async () => {
    const pid = await locked();
    expect(store().verdicts.filter((v) => v.partyId === pid && v.overriddenByCode)).toEqual([]);
    expect(store().blockedLines).toEqual([]);
    expect(store().traces.some((t) => t.meta?.kind === "rogue")).toBe(false);
  });

  it("never applies inside a sandbox: preflight's rehearsal still passes, with a note that it's on", async () => {
    setModelSettings({ rogue: true });
    const r = await runPreflight();
    const c = Object.fromEntries(r.checks.map((x) => [x.id, x]));
    expect(c.rehearsal!.status).toBe("ok");
    expect(c.pace).toMatchObject({ status: "warn", detail: expect.stringContaining("the rogue model is on") });
  });
});

describe("reset mid-talk (found with F27)", () => {
  it("a talk in progress stops when Reset everything replaces the store, and writes nothing into the new one", async () => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const pid = [...store().parties.keys()][0]!;
    const run = runParty(pid, { paceMs: 30 }); // slow enough to reset in the middle
    await new Promise((r) => setTimeout(r, 45));
    const fresh = resetStore();
    await run;
    expect(fresh.traces).toEqual([]);
    expect(fresh.table).toEqual([]);
    expect(fresh.events_log).toEqual([]);
    expect(fresh.pairs).toEqual([]);
  });
});
