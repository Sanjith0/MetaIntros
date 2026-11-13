import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { templateBrief } from "@/lib/companion/brief";
import { pairKey, runRoom, type HumanCheckIns, type RoomInput } from "@/lib/companion/room";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles(); // p01 is the only real person
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const pool = ["p01", ...[...people.values()].filter((p) => p.id !== "p01" && p.ageBand === people.get("p01")!.ageBand && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort()].slice(0, 8);
const input = (human?: HumanCheckIns): RoomInput => ({ ids: pool, people, briefs: new Map(pool.map((i) => [i, templateBrief(people.get(i)!, qctx)])), targetSize: 4, human });
const prompts = () => mockProvider().calls.map((c) => c.task + c.messages[1].content);
type Req = { messages: { content: string }[] };
const owner = (req: Req) => JSON.parse(req.messages[1].content).your_brief.ownerId as string;

describe("human check-ins", () => {
  beforeEach(() => mockProvider().reset());

  it("only real people are asked, once at picks and once per squad at sign-off", async () => {
    const asked: string[] = [];
    await runRoom(input({
      picks: async (u, offer) => { asked.push(`picks:${u}`); expect(offer.picks.length).toBeLessThanOrEqual(3); return null; },
      signoff: async (u) => { asked.push(`signoff:${u}`); return null; },
    }));
    expect(asked.filter((a) => a.startsWith("picks"))).toEqual(["picks:p01"]);
    expect(asked.every((a) => a.endsWith("p01"))).toBe(true);
  });

  it("nobody answering changes nothing: same prompts, same squads (so cached runs still replay)", async () => {
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: {} }));
    const plain = await runRoom(input());
    const a = prompts();
    mockProvider().calls.length = 0;
    const timedOut = await runRoom(input({ picks: async () => null, signoff: async () => null }));
    expect(prompts()).toEqual(a);
    expect(timedOut.parties.map((p) => p.members)).toEqual(plain.parties.map((p) => p.members));
  });

  it("someone the person drops is never put in their squad", async () => {
    const base = await runRoom(input());
    const mate = base.parties.find((p) => p.members.includes("p01"))!.members.find((m) => m !== "p01")!;
    const r = await runRoom(input({ picks: async () => ({ drop: [mate] }) }));
    for (const p of r.parties) expect(p.members.includes("p01") && p.members.includes(mate)).toBe(false);
    for (const rows of r.tables.values()) for (const row of rows) if (row.by === "p01") expect(row.members).not.toContain(mate);
    expect(r.deep).not.toContain(pairKey("p01", mate));
  });

  it("what the person tells their Companion reaches only their own Companion, and is never repeated", async () => {
    const told = "I want to dance until late tonight";
    mockProvider().on("companion_close", (req) => JSON.stringify({ says: {}, verdicts: {}, proposal: { members: [], line: { say: owner(req) === "p01" ? `My person said: ${told}` : "Happy with this.", cites: [] } } }));
    const r = await runRoom(input({ picks: async () => ({ drop: [], told }) }));
    const after = mockProvider().calls.filter((c) => ["companion_close", "companion_deliberate", "companion_group"].includes(c.task));
    const withTold = after.filter((c) => c.messages[1].content.includes(told));
    expect(withTold.length).toBeGreaterThan(0);
    for (const c of withTold) {
      expect(owner(c)).toBe("p01");
      expect(JSON.parse(c.messages[1].content).your_person_told_you.said).toEqual([told]);
    }
    const line = [...r.tables.values()].flat().find((row) => row.by === "p01")!.line;
    expect(line).not.toContain(told); // a line repeating it word for word is blocked
  });

  it("the person's own yes or no overrides their Companion at sign-off, and a no stays anonymous", async () => {
    mockProvider().on("companion_group", (req) => JSON.stringify({ line: { say: "Not sure about this one.", cites: [] }, decision: owner(req) === "p01" ? "no" : "yes", privateReason: "secret" }));
    const companionOnly = await runRoom(input());
    expect(companionOnly.parties.some((p) => p.members.includes("p01"))).toBe(false); // their Companion said no
    const human = await runRoom(input({ signoff: async () => ({ decision: "yes" }) }));
    expect(human.parties.some((p) => p.members.includes("p01"))).toBe(true); // the person said yes

    mockProvider().reset();
    const vetoed = await runRoom(input({ signoff: async () => ({ decision: "no" }) }));
    expect(vetoed.parties.some((p) => p.members.includes("p01"))).toBe(false);
    expect(vetoed.vetoed.length).toBeGreaterThan(0);
    expect(JSON.stringify(vetoed.parties.map((p) => [p.why, p.groupChat, p.steps]))).not.toMatch(/p01 said no|secret/);
  });

  it("a check-in that throws is treated as no answer", async () => {
    const r = await runRoom(input({ picks: async () => { throw new Error("phone gone"); }, signoff: async () => { throw new Error("phone gone"); } }));
    expect(r.parties.length).toBeGreaterThan(0);
  });
});
