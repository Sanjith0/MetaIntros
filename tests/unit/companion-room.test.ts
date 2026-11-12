import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import { pairKey, runRoom, sparksFor, type RoomInput, type RoomResult } from "@/lib/companion/room";
import { validateParty } from "@/lib/match/safety";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles(); // p01 is the only non-simulated person
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const pool = ["p01", ...[...people.values()].filter((p) => p.id !== "p01" && p.ageBand === people.get("p01")!.ageBand && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort()];
const input = (n: number, over: Partial<RoomInput> = {}): RoomInput => {
  const ids = pool.slice(0, n);
  return { ids, people, briefs: new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4, ...over };
};
const publicText = (r: RoomResult) =>
  JSON.stringify([...r.threads.values()]) + JSON.stringify([...r.tables.values()]) + JSON.stringify(r.parties.map((p) => [p.why, p.groupChat, p.steps]));
type Req = { messages: { content: string }[] };
const owner = (req: Req) => JSON.parse(req.messages[1].content).your_brief.ownerId as string;

describe("companion room", () => {
  beforeEach(() => mockProvider().reset());

  it("has a big enough pool", () => expect(pool.length).toBeGreaterThanOrEqual(30));

  it("forms valid parties of exactly targetSize from a room of 12", async () => {
    const stages: string[] = [];
    const r = await runRoom(input(12, { onStage: (s) => void stages.push(s) }));
    expect(r.parties.length).toBeGreaterThan(0);
    const used = r.parties.flatMap((p) => p.members);
    expect(new Set(used).size).toBe(used.length);
    for (const p of r.parties) {
      expect(p.members).toHaveLength(4);
      expect(validateParty(p.members.map((m) => people.get(m)!)).ok).toBe(true);
      expect(p.groupChat).toHaveLength(8); // two rounds, four members
      expect(p.steps[0].agent).toBe("orchestrator");
      expect(p.steps.some((s) => s.kind === "safety_check")).toBe(true);
      expect(p.steps.at(-1)!.kind).toBe("decision");
      expect(p.why.length).toBeGreaterThan(5);
      expect(sparksFor(p.members[0], p.members[1], r).length).toBeGreaterThan(0);
    }
    expect(stages).toEqual(["circles", "mingling", "deep", "deliberating", "forming", "group", "done"]);
    expect(r.calls).toBeGreaterThan(0);
    expect([...used, ...r.heldBack].sort()).toEqual(pool.slice(0, 12).sort());
  });

  it("every allowed pair in a circle has a 6-message thread; deep pairs have 10", async () => {
    const r = await runRoom(input(10));
    const m = r.circles[0].members;
    expect(m).toHaveLength(10);
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
      expect(r.threads.get(pairKey(m[i], m[j]))!.slice(0, 6).map((x) => x.kind)).toEqual(["intro", "intro", "ask", "ask", "answer", "answer"]);
    }
    expect(r.deep.length).toBeGreaterThan(0);
    for (const k of r.deep) expect(r.threads.get(k)!.map((x) => x.kind)).toEqual(["intro", "intro", "ask", "ask", "answer", "answer", "followup", "followup", "close", "close"]);
    for (const [k, t] of r.threads) if (!r.deep.includes(k)) expect(t).toHaveLength(6);
  });

  it("30 people: everyone is in one circle or unplaced", async () => {
    const r = await runRoom(input(30));
    const placed = r.circles.flatMap((c) => c.members);
    expect(r.circles.length).toBeGreaterThan(1);
    expect([...placed, ...r.unplaced].sort()).toEqual(pool.slice(0, 30).sort());
    expect(new Set(placed).size).toBe(placed.length);
    for (const p of r.parties) expect(r.circles.some((c) => p.members.every((m) => c.members.includes(m)))).toBe(true);
  });

  it("a disallowed pair never gets a thread and never shares a party", async () => {
    const ids = ["p01", "p09", ...pool.slice(1, 9)]; // p01 has blocked p09
    const r = await runRoom({ ids, people, briefs: new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4 });
    expect(r.threads.has(pairKey("p01", "p09"))).toBe(false);
    for (const p of r.parties) expect(p.members.includes("p01") && p.members.includes("p09")).toBe(false);
    for (const rows of r.tables.values()) for (const row of rows) expect(row.members.includes("p01") && row.members.includes("p09")).toBe(false);
  });

  it("a veto is binding, triggers at most one revision, and is anonymous", async () => {
    const base = await runRoom(input(10));
    const vetoer = base.parties[0].members.find((m) => m !== "p01")!;
    mockProvider().reset();
    mockProvider().on("companion_group2", (req) =>
      JSON.stringify(owner(req) === vetoer
        ? { line: { say: "Thanks all.", cites: [] }, decision: "no", need: "", privateReason: "would not be comfortable here" }
        : { line: { say: "Sounds good.", cites: [] }, decision: "yes", need: "", privateReason: "" }));
    const r = await runRoom(input(10));
    expect(r.vetoed.length).toBeGreaterThan(0);
    expect(r.vetoed.every((set) => set.includes(vetoer))).toBe(true);
    expect(r.parties.every((p) => !p.members.includes(vetoer))).toBe(true);
    expect(publicText(r)).not.toContain("would not be comfortable");
    expect(publicText(r)).not.toMatch(/veto|declin|said no/i);
    expect(mockProvider().calls.filter((c) => c.task === "orchestrator_form").length).toBeLessThanOrEqual(2 * r.circles.length);
  });

  it("when everyone vetoes, no party forms and nobody is blamed", async () => {
    mockProvider().on("companion_group2", () => JSON.stringify({ line: { say: "Hm.", cites: [] }, decision: "no", need: "", privateReason: "secret reason" }));
    const stages: string[] = [];
    const r = await runRoom(input(8, { onStage: (s) => void stages.push(s) }));
    expect(r.parties).toEqual([]);
    expect(r.heldBack.sort()).toEqual(pool.slice(0, 8).sort());
    expect(publicText(r)).not.toContain("secret reason");
    expect(stages.at(-1)).toBe("waiting");
  });

  it("a rogue model cannot leak private facts or force a party", async () => {
    const ids = pool.slice(0, 8);
    const briefs = new Map(ids.map((i) => {
      const hidden = sourceFacts(people.get(i)!)[0];
      return [i, templateBrief(people.get(i)!, qctx, { [hidden.id]: "private" })] as const;
    }));
    const leak = (req: Req) => ({ say: `My person is into ${privateTexts(briefs.get(owner(req))!)[0]}.`, cites: [] as string[] });
    const toAll = (req: Req) => Object.fromEntries(ids.filter((i) => i !== owner(req)).map((i) => [i, leak(req)]));
    mockProvider()
      .on("companion_ask", (req) => JSON.stringify({ asks: toAll(req) }))
      .on("companion_answer", (req) => JSON.stringify({ answers: toAll(req), picks: ids, verdicts: Object.fromEntries(ids.map((i) => [i, { score: 100 }])) }))
      .on("companion_followup", (req) => JSON.stringify({ says: toAll(req) }))
      .on("companion_close", (req) => JSON.stringify({ says: toAll(req), verdicts: {}, proposal: { members: ids, line: leak(req) } }))
      .on("companion_deliberate", (req) => JSON.stringify({ action: "hold", line: leak(req) }))
      .on("companion_group1", (req) => JSON.stringify({ line: leak(req) }))
      .on("companion_group2", (req) => JSON.stringify({ line: leak(req), decision: "yes" }));
    const r = await runRoom({ ids, people, briefs, targetSize: 4 });
    const text = publicText(r);
    // each person's own Companion never says that person's private fact
    for (const [id, b] of briefs) {
      const said = [...r.threads.values()].flat().filter((m) => m.from === id).map((m) => m.say).join("\n") + r.parties.flatMap((p) => p.groupChat).filter((l) => l.from === id).map((l) => l.say).join("\n") + [...r.tables.values()].flat().filter((t) => t.by === id).map((t) => t.line).join("\n");
      for (const s of privateTexts(b)) expect(said).not.toContain(s);
    }
    expect(text).toContain("Happy to hear more about your person.");
    for (const p of r.parties) expect(p.members).toHaveLength(4);
  });

  it("garbage from every call still completes on fallbacks", async () => {
    for (const t of ["companion_ask", "companion_answer", "companion_followup", "companion_close", "companion_deliberate", "companion_group1", "companion_group2", "orchestrator_form"]) mockProvider().on(t, () => "not json at all");
    const r = await runRoom(input(8));
    expect(r.parties.length).toBeGreaterThan(0);
  });

  it("a person with everything private still completes and cites nothing", async () => {
    const ids = pool.slice(0, 8);
    const briefs = new Map(ids.map((i) => [i, templateBrief(people.get(i)!, qctx)]));
    const all = Object.fromEntries(sourceFacts(people.get("p01")!).map((f) => [f.id, "private" as const]));
    briefs.set("p01", templateBrief(people.get("p01")!, qctx, all));
    const r = await runRoom({ ids, people, briefs, targetSize: 4 });
    const mine = [...r.threads.values()].flat().filter((m) => m.from === "p01");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((m) => m.cites.length === 0)).toBe(true);
    for (const s of privateTexts(briefs.get("p01")!)) expect(mine.map((m) => m.say).join("\n")).not.toContain(s);
  });

  it("an all-simulated room makes no model calls; exclude is honoured; prompts are deterministic", async () => {
    const sims = pool.slice(1, 9);
    const base = { ids: sims, people, briefs: new Map(sims.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4 };
    const firstRun = await runRoom(base);
    expect(mockProvider().calls).toHaveLength(0);
    expect(firstRun.calls).toBe(0);
    expect(firstRun.parties.length).toBeGreaterThan(0);
    const again = await runRoom({ ...base, exclude: firstRun.parties.map((p) => p.members) });
    const key = (m: string[]) => [...m].sort().join();
    for (const p of again.parties) expect(firstRun.parties.map((x) => key(x.members))).not.toContain(key(p.members));
    await runRoom(input(8));
    const promptsA = mockProvider().calls.map((c) => c.task + c.messages[1].content);
    expect(promptsA.length).toBeGreaterThan(0);
    mockProvider().reset();
    await runRoom(input(8));
    expect(mockProvider().calls.map((c) => c.task + c.messages[1].content)).toEqual(promptsA);
  });
});
