import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { templateBrief } from "@/lib/companion/brief";
import { buildRecap, similarity } from "@/lib/companion/recap";
import { pairKey, runRoom, type LiveEvent } from "@/lib/companion/room";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const pool = ["p01", ...[...people.values()].filter((p) => p.id !== "p01" && p.ageBand === people.get("p01")!.ageBand && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort()].slice(0, 10);
const input = () => ({ ids: pool, people, briefs: new Map(pool.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4 });
type Req = { messages: { content: string }[] };
const owner = (req: Req) => JSON.parse(req.messages[1].content).your_brief.ownerId as string;

describe("Companion recap and the numbers comparison", () => {
  beforeEach(() => mockProvider().reset());

  it("shows a member their own conversations and their own Companion's notes only", async () => {
    const r = await runRoom(input());
    const party = r.parties.find((p) => p.members.includes("p01"))!;
    const recap = buildRecap("p01", party, r, people, pool);
    expect(recap.squad.map((s) => s.id).sort()).toEqual(party.members.filter((m) => m !== "p01").sort());
    for (const s of recap.squad) {
      expect(s.thread.length).toBeGreaterThanOrEqual(6);
      expect(s.thread.map((l) => l.say)).toEqual(r.threads.get(pairKey("p01", s.id))!.map((l) => l.say));
      expect(s.notes).toEqual(r.verdicts.get("p01")!.get(s.id)); // my Companion's notes about them…
      expect(s.notes).not.toBe(r.verdicts.get(s.id)!.get("p01")); // …never theirs about me
    }
    expect(recap.talkedWith).toBe([...r.threads.keys()].filter((k) => k.split("|").includes("p01")).length);
    expect(recap.groupChat).toEqual(party.groupChat);
  });

  it("the similarity pick is the top-ranked people by the old score; differences are explained only from my Companion's notes", async () => {
    mockProvider().on("companion_answer", (req) => {
      const me = owner(req);
      const u = JSON.parse(req.messages[1].content);
      return JSON.stringify({
        answers: {},
        verdicts: Object.fromEntries(u.circle_mates.map((m: { id: string }) => [m.id, { score: 50, wouldEnjoy: [`Both love ${me === "p01" ? "trading show stories" : "chatting"}`], concerns: me === "p01" ? [`${m.id} wants a loud late night`] : [] }])),
        picks: [],
      });
    });
    const r = await runRoom(input());
    const party = r.parties.find((p) => p.members.includes("p01"))!;
    const recap = buildRecap("p01", party, r, people, pool);
    const ranked = pool.filter((id) => id !== "p01").map((id) => [id, similarity(people.get("p01")!, people.get(id)!)] as const).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    expect(recap.numbers.similarityPick.map((x) => x.id)).toEqual(ranked.slice(0, 3).map(([id]) => id));
    const inSquad = new Set(recap.numbers.companionPick);
    expect(recap.numbers.passedOver.map((x) => x.id)).toEqual(recap.numbers.similarityPick.filter((x) => !inSquad.has(x.id)).map((x) => x.id));
    for (const x of recap.numbers.passedOver) expect(x.reason).toBe(`Your Companion noted: ${x.id} wants a loud late night`);
    for (const x of recap.numbers.chosenAnyway) expect(x.reason).toBe("Your Companion found: Both love trading show stories");
    expect(recap.numbers.agreed + recap.numbers.chosenAnyway.length).toBe(3);
  });

  it("live events stream every line and note as they happen", async () => {
    const events: LiveEvent[] = [];
    const r = await runRoom({ ...input(), onLive: (e) => void events.push(e) });
    const lines = events.filter((e) => e.type === "line");
    expect(lines).toHaveLength([...r.threads.values()].reduce((n, t) => n + t.length, 0));
    expect(events.filter((e) => e.type === "notes" && e.from === "p01").length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === "proposal")).toBe(true);
    expect(events.some((e) => e.type === "groupDone" && e.ok)).toBe(true);
    // a viewer that throws never breaks the room
    const again = await runRoom({ ...input(), onLive: () => { throw new Error("viewer crashed"); } });
    expect(again.parties.length).toBe(r.parties.length);
  });
});
