import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { auditContext, privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag, setFlagOverride } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

async function locked() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("context audit (F19)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    setFlagOverride("CONTEXT_AUDIT", null);
  });

  it("is on by default", () => expect(flag("CONTEXT_AUDIT")).toBe(true));

  it("every agent turn carries an audit: its own rules, and nobody else's words", async () => {
    const pid = await locked();
    const turns = store().traces.filter((t) => t.partyId === pid && t.meta?.kind === "verdicts");
    expect(turns.length).toBeGreaterThanOrEqual(5 * 2);
    for (const t of turns) {
      const c = t.meta!.context!;
      expect(c.others, t.title).toBe(0);
      expect(c.own, t.title).toBe(store().briefs.get(`brief-${t.actorId}`)!.hardRules.length);
      expect(c.chars).toBeGreaterThan(200);
    }
    expect(store().traces.some((t) => t.title.startsWith("Context audit failed"))).toBe(false);
  });

  it("keeps the exact prompt per agent and round, and Maya's holds her words but not Dev's", async () => {
    const pid = await locked();
    const p = store().prompts.get(`${pid}:maya:1`)!;
    expect(p.system.length).toBeGreaterThan(50);
    for (const w of ["out by eleven", "under twenty bucks", "nowhere I have to drink"]) expect(p.user).toContain(w);
    for (const w of privatePhrases(pid, "dev")) expect(p.user).not.toContain(w);
    expect(auditContext(p.user, pid, "maya").others).toEqual([]);
    // One prompt per member per round they spoke in.
    for (const id of ["maya", "dev", "ana", "kai", "zoe"]) expect(store().prompts.has(`${pid}:${id}:1`)).toBe(true);
  });

  it("is a real check: a planted phrase from someone else's brief is caught and named to its owner", async () => {
    const pid = await locked();
    const p = store().prompts.get(`${pid}:maya:1`)!;
    const dev = store().briefs.get("brief-dev")!;
    const planted = p.user.replace(`"public_table"`, `"note":${JSON.stringify(dev.hardRules[0]!.sourceText)},"public_table"`);
    expect(planted).not.toBe(p.user);
    const a = auditContext(planted, pid, "maya");
    expect(a.others).toEqual([{ ownerId: "dev", text: dev.hardRules[0]!.sourceText }]);
    // Another member's private reason from a rejection is caught too.
    const reason = store().verdicts.find((v) => v.partyId === pid && v.ownerId === "kai" && v.decision === "reject")?.privateReason;
    if (reason) expect(auditContext(p.user + JSON.stringify(reason), pid, "maya").others.map((o) => o.ownerId)).toContain("kai");
  });

  it("switched off, turns carry no audit and no prompt is kept", async () => {
    setFlagOverride("CONTEXT_AUDIT", false);
    const pid = await locked();
    expect(store().prompts.size).toBe(0);
    expect(store().traces.filter((t) => t.partyId === pid && t.meta?.context).length).toBe(0);
    setFlagOverride("CONTEXT_AUDIT", null);
  });
});
