import { beforeEach, describe, expect, it } from "vitest";
import { PlanUnavailablePayload } from "@/contracts";
import { DEMO_PARTY as D } from "@/fixtures";
import type { LaterOut, Round1Out } from "@/lib/agents/agent";
import { buildBrief } from "@/lib/agents/brief";
import { runParty } from "@/lib/agents/orchestrator";
import { verifyPublicLine } from "@/lib/agents/verifier";
import { publish, visibleTo } from "@/lib/server/bus";
import { joinQueue } from "@/lib/server/queue";
import { factById, resetStore, store } from "@/lib/server/store";
import { memberPartyView } from "@/lib/server/views";
import { chatView } from "@/lib/server/social";

const MAYA_RULE_TEXT = ["nowhere I have to drink", "out by eleven", "under twenty bucks", D.sentences.maya!];
const ROOFTOP = "plan-evt-rooftop";
const OTHERS = D.memberIds.filter((id) => id !== "maya");

async function formDemoParty(): Promise<string> {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  return [...store().parties.keys()][0]!;
}

/** Everything another member could ever load or receive. */
function everythingVisibleTo(partyId: string, viewer: string): string {
  const s = store();
  const view = memberPartyView(partyId, viewer);
  const events = s.events_log.filter((e) => visibleTo(e, { userId: viewer }));
  const chat = s.parties.get(partyId)?.chatId ? chatView(s.parties.get(partyId)!.chatId!, viewer) : null;
  return JSON.stringify({ view, events, chat });
}

describe("agents: the four required cases", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("Maya's drink rule rejects the rooftop plan", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const s = store();
    const verdict = s.verdicts.find((v) => v.ownerId === "maya" && v.planId === ROOFTOP && v.round === 1)!;
    expect(verdict.decision).toBe("reject");
    const check = s.codeChecks.find((c) => c.ownerId === "maya" && c.planId === ROOFTOP && c.ruleKind === "no_drink_minimum")!;
    expect(check.pass).toBe(false);
    expect(s.parties.get(pid)!.planId).not.toBe(ROOFTOP);
  });

  it("code still rejects the rooftop when Maya's model says accept", async () => {
    const pid = await formDemoParty();
    const override = (owner: string, round: number, out: Round1Out | LaterOut) => {
      if (owner !== "maya" || round !== 1) return out;
      const r1 = out as Round1Out;
      return { ...r1, verdicts: r1.verdicts.map((v) => (v.planId === ROOFTOP ? { ...v, decision: "accept" as const, preference: 5 } : v)) };
    };
    await runParty(pid, { paceMs: 0, override });
    const v = store().verdicts.find((x) => x.ownerId === "maya" && x.planId === ROOFTOP && x.round === 1)!;
    expect(v.decision).toBe("reject");
    expect(v.overriddenByCode).toBe(true);
  });

  it("the plan.unavailable payload has no reason field", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const unavailable = store().events_log.filter((e) => e.type === "plan.unavailable");
    expect(unavailable.map((e) => (e.payload as { planId: string }).planId)).toContain(ROOFTOP);
    for (const e of unavailable) {
      expect(Object.keys(e.payload).sort()).toEqual(["partyId", "planId", "round"]);
      expect(e.payload).not.toHaveProperty("reason");
    }
    // The contract refuses one, and so does the bus.
    expect(PlanUnavailablePayload.safeParse({ partyId: pid, planId: ROOFTOP, round: 1, reason: "drink minimum" }).success).toBe(false);
    expect(() => publish("plan.unavailable", { partyId: pid, planId: ROOFTOP, round: 1, reason: "x" } as never, ["dev"])).toThrow();
    // And the table text names the plan, nothing more.
    const marks = store().table.filter((t) => t.kind === "unavailable");
    for (const m of marks) expect(m.text).toMatch(/· unavailable$/);
  });

  it("no other member's page contains her rule text", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const mayaReasons = store().verdicts.filter((v) => v.ownerId === "maya").map((v) => v.privateReason);
    for (const other of OTHERS) {
      const seen = everythingVisibleTo(pid, other);
      // A generic reason ("fits your rules, 5/5") can be word-for-word the viewer's own; skip those.
      const ownReasons = new Set(store().verdicts.filter((v) => v.ownerId === other).map((v) => v.privateReason));
      const mayaOnly = mayaReasons.filter((r) => !ownReasons.has(r));
      expect(mayaOnly.length).toBeGreaterThan(0);
      for (const text of [...MAYA_RULE_TEXT, ...mayaOnly]) expect(seen).not.toContain(text);
    }
    // Maya herself can see her own reasons on her receipt.
    expect(JSON.stringify(memberPartyView(pid, "maya")!.receipt)).toContain("nowhere I have to drink");
  });

  it("the verifier blocks a planted leak", async () => {
    // Unit: a line not built from approved lines or neutral phrases.
    const { brief } = await buildBrief("maya", D.sentences.maya!, store().profiles.get("maya")!.facts);
    const leak = { text: "I can't do the rooftop, I don't drink", sourceIds: ["neutral-works"] };
    const v = verifyPublicLine(leak, brief);
    expect(v.ok).toBe(false);
    expect(v.line.text).toBe("That works for me.");
    // A line built from a rule id is blocked too.
    expect(verifyPublicLine({ text: "out by eleven", sourceIds: ["hr-maya-end"] }, brief).ok).toBe(false);
    // An approved line passes, verbatim.
    expect(verifyPublicLine({ text: "Up for something low-key.", sourceIds: ["sl-maya-chill"] }, brief).ok).toBe(true);

    // Integration: plant the leak in Maya's round-1 output.
    const pid = await formDemoParty();
    const override = (owner: string, round: number, out: Round1Out | LaterOut) =>
      owner === "maya" && round === 1 ? { ...(out as Round1Out), publicLine: leak } : out;
    await runParty(pid, { paceMs: 0, override });
    const s = store();
    expect(s.blockedLines.some((b) => b.ownerId === "maya" && b.text === leak.text)).toBe(true);
    expect(s.table.some((t) => t.text.includes("I don't drink"))).toBe(false);
    for (const other of OTHERS) expect(everythingVisibleTo(pid, other)).not.toContain("I don't drink");
    expect(s.receipts.get(`${pid}:maya`)!.blockedLines).toBe(1);
  });
});

describe("agents: table talk, judge, pair talk", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("locks the demo plan with five signatures by round 3", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const party = store().parties.get(pid)!;
    expect(party.status).toBe("locked");
    expect(party.planId).toBe(`plan-${D.expectedPlanEventId}`);
    expect(party.lockedBy).toBe("signatures");
    expect(party.signatures).toHaveLength(5);
    // Each agent was a separate turn each round.
    for (const r of [1, 2, 3]) expect(new Set(store().verdicts.filter((v) => v.round === r).map((v) => v.ownerId)).size).toBe(r === 1 ? 5 : 5);
  });

  it("falls back to the best feasible plan when round 3 ends without five signatures", async () => {
    const pid = await formDemoParty();
    const override = (owner: string, round: number, out: Round1Out | LaterOut) =>
      owner === "kai" && round > 1 ? { ...(out as LaterOut), decision: "hold" as const, planId: "plan-evt-clay" } : out;
    await runParty(pid, { paceMs: 0, override });
    const party = store().parties.get(pid)!;
    expect(party.lockedBy).toBe("fallback");
    expect(party.planId).toBe(`plan-${D.expectedPlanEventId}`);
    expect(store().table.some((t) => t.text.startsWith("Locked:"))).toBe(true);
  });

  it("every public table line is built from approved lines or neutral phrases", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    for (const t of store().table.filter((x) => x.kind === "line")) {
      for (const id of t.sourceIds) {
        const ok = id.startsWith("neutral-") || store().briefs.get(`brief-${t.authorId}`)!.shareable.some((l) => l.id === id && l.approved);
        expect(ok, `${t.text} -> ${id}`).toBe(true);
      }
    }
  });

  it("pair talk: one shared line and an opener each way, every claim on an approved fact", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const s = store();
    const keys = new Set(s.pairs.map((p) => p.pairKey));
    expect(keys.size).toBe(10);
    for (const key of keys) {
      const [a, b] = key.split("|");
      const msgs = s.pairs.filter((p) => p.pairKey === key);
      expect(msgs.filter((m) => m.kind === "shared")).toHaveLength(1);
      expect(msgs.filter((m) => m.kind === "opener").map((m) => m.fromId).sort()).toEqual([a, b].sort());
      for (const m of msgs) {
        for (const id of m.sourceIds) {
          const fact = factById(id);
          const bridge = s.parties.get(pid)!.bridges.find((br) => br.id === id);
          expect(!!bridge || (fact?.approved === true && [a, b].includes(fact.ownerId)), `${m.text} -> ${id}`).toBe(true);
        }
      }
      // An opener is about the other person, built from their approved fact.
      for (const o of msgs.filter((m) => m.kind === "opener")) expect(factById(o.sourceIds[0]!)!.ownerId).toBe(o.toId);
    }
  });

  it("an unapproved fact never reaches anyone", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const hidden = store().profiles.get("maya")!.facts.find((f) => !f.approved)!;
    for (const id of D.memberIds) {
      const seen = everythingVisibleTo(pid, id);
      expect(seen).not.toContain(hidden.text);
      expect(seen).not.toContain(hidden.id);
    }
  });

  it("receipts tell each owner what their agent considered, rejected and said", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const r = store().receipts.get(`${pid}:maya`)!;
    expect(r.considered).toHaveLength(5);
    expect(r.rejected.map((x) => x.planId).sort()).toEqual(["plan-evt-rooftop", "plan-evt-supper", "plan-evt-synth"]);
    expect(r.toldParty.length).toBeGreaterThanOrEqual(3);
    expect(r.finalPlanId).toBe(`plan-${D.expectedPlanEventId}`);
    // Dev's view carries only Dev's receipt.
    expect(memberPartyView(pid, "dev")!.receipt!.ownerId).toBe("dev");
  });

  it("the group chat opens with the plan pinned and one opener per person", async () => {
    const pid = await formDemoParty();
    await runParty(pid, { paceMs: 0 });
    const party = store().parties.get(pid)!;
    const chat = chatView(party.chatId!, "maya")!;
    expect(chat.pinned?.text).toContain("Dolores Night Market");
    const openers = chat.messages.filter((m) => m.kind === "opener");
    expect(openers.map((m) => m.senderId).sort()).toEqual([...D.memberIds].sort());
  });
});
