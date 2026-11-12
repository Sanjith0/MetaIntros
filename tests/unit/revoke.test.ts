import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { explainSources } from "@/lib/server/provenance";
import { joinQueue } from "@/lib/server/queue";
import { GREETING, REMOVED, revokeFact, sharedFacts } from "@/lib/server/revoke";
import { everythingVisibleTo } from "@/lib/server/secret";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("take back what you shared (F57)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("REVOKE_SHARING")).toBe(true));

  it("Maya stops sharing film photography: nothing any of the four can load still holds it", async () => {
    const pid = await locked();
    // Maya's fact: its text, its question, and her line built from it. (Zoe's own "good shots lately?" is Zoe's to share.)
    const film = ["shoots film", "point-and-shoot", "what are you shooting"];
    const before = everythingVisibleTo(pid, "zoe").text.toLowerCase();
    expect(film.some((w) => before.includes(w))).toBe(true);
    const r = revokeFact("maya", "maya-f1");
    expect(r.rewritten.cards).toBeGreaterThanOrEqual(2);
    for (const other of ["dev", "ana", "kai", "zoe"]) {
      const seen = everythingVisibleTo(pid, other).text.toLowerCase();
      for (const w of film) expect(seen, `${other}: ${w}`).not.toContain(w);
    }
    const s = store();
    // Zoe's card about Maya: the tie stays, the shared line and opener go; its sources still explain.
    const card = s.cards.find((c) => c.viewerId === "zoe" && c.subjectId === "maya")!;
    expect(card).toMatchObject({ sharedLine: null, opener: GREETING });
    expect(card.bridgeLine).toBeTruthy();
    for (const it of explainSources(card.sourceIds, "zoe", pid)) expect(it.ok, it.text).toBe(true);
    // Chat openers built from it say so; Maya's approved line from it is withdrawn.
    expect(s.messages.some((m) => m.text === REMOVED)).toBe(true);
    expect(s.briefs.get("brief-maya")!.shareable.filter((l) => l.factIds.includes("maya-f1")).every((l) => !l.approved)).toBe(true);
    expect(sharedFacts("maya").map((f) => f.id)).not.toContain("maya-f1");
  });

  it("only your own facts, once", async () => {
    await locked();
    expect(() => revokeFact("maya", "zoe-f4")).toThrow("That isn't one of your facts.");
    revokeFact("maya", "maya-f1");
    expect(() => revokeFact("maya", "maya-f1")).toThrow("already stopped sharing");
  });
});
