import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { explainSources } from "@/lib/server/provenance";
import { joinQueue } from "@/lib/server/queue";
import { factById, resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("why this line (F23)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("WHY_LINE")).toBe(true));

  it("Maya's card for Dev: both facts, both approved, and a tie that names nobody", async () => {
    const pid = await locked();
    const c = store().cards.find((x) => x.viewerId === "maya" && x.subjectId === "dev")!;
    expect(explainSources(c.sourceIds, "maya", pid).map((i) => i.text)).toEqual([
      "Dev listed “farmers market” on their profile and approved sharing it.",
      "You listed “farmers market” on your profile and approved sharing it.",
      "Code found a friend you share. They aren't named: they haven't opted in.",
    ]);
  });

  it("every card and opener in the party explains fully, with no ids, no unnamed third person and nobody's private words", async () => {
    const pid = await locked();
    const s = store();
    const party = s.parties.get(pid)!;
    const hidden = party.bridges.filter((b) => b.kind === "mutual_friend").map((b) => b.viaName);
    const secrets = FIVE.flatMap((id) => privatePhrases(pid, id));
    const lines = [
      ...s.cards.filter((c) => c.partyId === pid).map((c) => ({ ids: c.sourceIds, viewer: c.viewerId })),
      ...s.messages.filter((m) => m.kind === "opener").flatMap((m) => FIVE.map((viewer) => ({ ids: m.sourceIds, viewer }))),
    ];
    expect(lines.length).toBeGreaterThanOrEqual(20 + 25);
    for (const { ids, viewer } of lines) {
      const items = explainSources(ids, viewer, pid);
      expect(items.length).toBe(ids.length);
      for (const it of items) {
        expect(it.ok, it.text).toBe(true);
        expect(it.text).not.toMatch(/\b[a-z]+-f\d+\b|br-|bf-|plan-evt/);
        for (const name of hidden) expect(it.text).not.toContain(name);
        for (const w of secrets) expect(it.text).not.toContain(w);
      }
    }
  });

  it("is a real check: an unapproved fact, someone outside the party, or an unknown id is flagged, not explained", async () => {
    const pid = await locked();
    const f = factById("dev-f4")!;
    f.approved = false;
    expect(explainSources(["dev-f4"], "maya", pid)).toEqual([{ kind: "fact", text: "A source that wasn't approved.", ok: false }]);
    f.approved = true;
    const outsider = [...store().profiles.values()].find((p) => !FIVE.includes(p.id) && p.facts.some((x) => x.approved))!;
    expect(explainSources([outsider.facts.find((x) => x.approved)!.id], "maya", pid)[0]!.ok).toBe(false);
    expect(explainSources(["made-up"], "maya", pid)).toEqual([{ kind: "unknown", text: "A source this app can't explain.", ok: false }]);
  });

  it("a brief line says it was approved, and a plan pin names the plan", async () => {
    const pid = await locked();
    expect(explainSources(["bf-dev-music"], "maya", pid)[0]!.text).toBe("Dev approved the line “Would love some live music.”");
    expect(explainSources(["bf-dev-music"], "dev", pid)[0]!.text).toBe("You approved the line “Would love some live music.” from your sentence.");
    expect(explainSources(["plan-evt-night-market"], "maya", pid)[0]!.text).toBe("Your party's plan: Dolores Night Market.");
  });
});

describe("why this, in the chat (F32)", () => {
  it("is on by default, and the pinned plan and all five openers in the party chat explain fully", async () => {
    expect(flag("CHAT_WHY")).toBe(true);
    process.env.PQ_PACE_MS = "0";
    const pid = await locked();
    const s = store();
    const chatId = s.parties.get(pid)!.chatId!;
    const msgs = s.messages.filter((m) => m.chatId === chatId && (m.kind === "opener" || m.kind === "pinned") && m.sourceIds.length);
    expect(msgs.filter((m) => m.kind === "opener")).toHaveLength(5);
    const pinned = msgs.find((m) => m.kind === "pinned")!;
    expect(explainSources(pinned.sourceIds, "maya", pid)).toEqual([{ kind: "plan", text: "Your party's plan: Dolores Night Market.", ok: true }]);
    for (const m of msgs) for (const it of explainSources(m.sourceIds, "maya", pid)) expect(it.ok, m.text).toBe(true);
  });
});
