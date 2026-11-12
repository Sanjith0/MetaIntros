import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { templateBrief } from "@/lib/companion/brief";
import * as orc from "@/lib/companion/orchestrator";
import { pairAllowed } from "@/lib/match/safety";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const ctx = { mode: "events" as const, eventTitle: null, targetSize: 4 };
// 30 adults who are all mutually allowed (same age band, no blocks, no women-only)
const adults = [...people.values()].filter((p) => p.ageBand === "18-24" && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort().slice(0, 30);
const briefs = (ids: string[]) => new Map(ids.map((i) => [i, templateBrief(people.get(i)!, ctx)]));
const v = (score: number): orc.Verdict => ({ score, wouldEnjoy: [], concerns: [], needs: [], talkTopics: [], opener: "", confidence: "medium" });
const verdicts = (ids: string[], score = 50): orc.Verdicts => new Map(ids.map((a) => [a, new Map(ids.filter((b) => b !== a).map((b) => [b, v(score)]))]));

describe("orchestrator", () => {
  beforeEach(() => mockProvider().reset());

  it("has enough mutually-allowed adults for these tests", () => {
    expect(adults).toHaveLength(30);
    for (const a of adults) for (const b of adults) if (a !== b) expect(pairAllowed(people.get(a)!, people.get(b)!)).toBe(true);
  });

  it("pairScore is the lower score, 0 when missing", () => {
    const [a, b] = adults;
    const vs = verdicts([a, b]);
    vs.get(a)!.set(b, v(90));
    vs.get(b)!.set(a, v(60));
    expect(orc.pairScore(vs, a, b)).toBe(60);
    expect(orc.pairScore(new Map(), a, b)).toBe(0);
  });

  it("a room of 15 or fewer is one circle with no model call", async () => {
    const out = await orc.drawCircles(briefs(adults.slice(0, 12)), people, 4, true);
    expect(out.circles).toHaveLength(1);
    expect(out.circles[0].members).toEqual(adults.slice(0, 12));
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("30 people fall back to valid circles covering everyone once", async () => {
    const out = await orc.drawCircles(briefs(adults), people, 4, true);
    const placed = out.circles.flatMap((c) => c.members);
    expect([...placed, ...out.unplaced].sort()).toEqual(adults);
    expect(new Set(placed).size).toBe(placed.length);
    expect(out.circles.every((c) => c.members.length >= orc.MIN_CIRCLE && c.members.length <= orc.MAX_CIRCLE)).toBe(true);
    expect(mockProvider().calls.filter((c) => c.task === "orchestrator_circles")).toHaveLength(1);
  });

  it("uses the model's circles, and places anyone the model forgot", async () => {
    mockProvider().on("orchestrator_circles", () => JSON.stringify({ circles: [{ theme: "Night owls", members: adults.slice(0, 14) }, { theme: "Early birds", members: adults.slice(14, 28) }] }));
    const out = await orc.drawCircles(briefs(adults), people, 4, true);
    expect(out.source).toBe("mock");
    expect(out.circles.map((c) => c.theme)).toEqual(["Night owls", "Early birds"]);
    expect(out.unplaced).toEqual([]);
    expect(out.circles.flatMap((c) => c.members).sort()).toEqual(adults);
  });

  it("fixCircles repairs bad model output", () => {
    const raw = [{ theme: "a", members: [...adults.slice(0, 10), "ghost", adults[0]] }, { theme: "b", members: adults.slice(10, 13) }];
    const out = orc.fixCircles(raw, adults, people, orc.MIN_CIRCLE);
    expect(out.circles).toHaveLength(1);
    expect(out.circles[0].members).toEqual(adults.slice(0, 10));
    expect(out.unplaced.sort()).toEqual(adults.slice(10));
  });

  it("deepPairs: one-sided picks, score gaps, the cap, and never a disallowed pair", () => {
    const m = adults.slice(0, 8);
    const vs = verdicts(m);
    vs.get(m[0])!.set(m[1], v(90));
    vs.get(m[1])!.set(m[0], v(40));
    const picks = new Map([[m[2], [m[3]]], [m[7], m.slice(0, 7)]]);
    const pairs = orc.deepPairs(picks, vs, m, people).map((p) => p.join("|"));
    expect(pairs).toContain([m[0], m[1]].join("|"));
    expect(pairs).toContain([m[2], m[3]].join("|"));
    expect(pairs.filter((p) => p.includes(m[7])).length).toBe(orc.MAX_DEEP);
    const blockedPair = ["p01", "p09"]; // seeded block
    expect(orc.deepPairs(new Map([["p01", ["p09"]]]), verdicts(blockedPair), blockedPair, people)).toEqual([]);
  });

  it("wanted collects proposed, amended and backed groups", () => {
    const [a, b, c, d] = adults;
    const table = [{ id: "prop-" + a, by: a, members: [a, b, c], line: "", backers: [b] }];
    const responses = new Map<string, orc.TableResponse>([[b, { action: "back", proposalId: "prop-" + a }], [d, { action: "amend", proposalId: "prop-" + a, members: [a, b, d] }]]);
    const w = orc.wanted(table, responses);
    expect([...w.get(a)!].sort()).toEqual([b, c].sort());
    expect([...w.get(b)!].sort()).toEqual([a, c].sort());
    expect([...w.get(d)!].sort()).toEqual([a, b].sort());
  });

  it("validateParties enforces size, reuse, wanted, exclude and safety", () => {
    const [a, b, c, d, e] = adults;
    const want = new Map([[a, new Set([b, c])], [b, new Set([a])], [c, new Set([a])]]);
    const ok = { members: [a, b, c], why: "x" };
    const run = (ps: orc.ProposedParty[], size = 3, exclude: string[][] = []) => orc.validateParties(ps, [a, b, c, d, e], want, people, size, exclude);
    expect(run([ok])).toEqual([ok]);
    expect(run([ok], 4)).toEqual([]); // wrong size
    expect(run([{ members: [a, b, d], why: "" }])).toEqual([]); // d wanted by nobody
    expect(run([ok, { members: [a, b, c], why: "" }])).toEqual([ok]); // reuse
    // someone nobody else picked can still be in a group their own Companion chose in full
    const lone = new Map([[d, new Set([a, b])]]);
    expect(orc.validateParties([{ members: [a, b, d], why: "" }], [a, b, c, d, e], lone, people, 3, [])).toHaveLength(1);
    expect(orc.validateParties([{ members: [a, b, d], why: "" }], [a, b, c, d, e], new Map([[d, new Set([a])]]), people, 3, [])).toEqual([]);
    expect(run([ok], 3, [[c, b, a]])).toEqual([]); // vetoed set
    const unsafe = { members: ["p01", "p09", a], why: "" };
    const w2 = new Map([["p01", new Set(["p09", a])], ["p09", new Set(["p01"])], [a, new Set(["p01"])]]);
    expect(orc.validateParties([unsafe], ["p01", "p09", a], w2, people, 3, [])).toEqual([]);
  });

  it("formParties falls back to the most-backed valid proposal and re-validates the model", async () => {
    const m = adults.slice(0, 5);
    const circle = { id: "c1", theme: "", members: m };
    const table = [{ id: "prop-" + m[0], by: m[0], members: m.slice(0, 3), line: "", backers: [m[1], m[2]] }];
    const want = new Map([[m[0], new Set([m[1], m[2]])], [m[1], new Set([m[0], m[2]])], [m[2], new Set([m[0], m[1]])]]);
    const input = { circle, table, want, verdicts: verdicts(m), briefs: briefs(m), people, targetSize: 3, exclude: [], attempt: 1, useModel: true };
    const fb = await orc.formParties(input);
    expect(fb.source).toBe("fallback");
    expect(fb.parties[0].members).toEqual(m.slice(0, 3));
    expect(fb.heldBack.sort()).toEqual(m.slice(3));
    mockProvider().on("orchestrator_form", () => JSON.stringify({ parties: [{ members: [m[0], m[3], m[4]], why: "I decided" }] }));
    expect((await orc.formParties(input)).parties.map((p) => p.members)).toEqual([m.slice(0, 3)]); // m[3], m[4] were wanted by nobody
    mockProvider().on("orchestrator_form", () => JSON.stringify({ parties: [{ members: [m[2], m[1], m[0]], why: "You three all love the same shows." }] }));
    const ok = await orc.formParties(input);
    expect(ok.source).toBe("mock");
    expect(ok.parties).toEqual([{ members: m.slice(0, 3), why: "You three all love the same shows." }]);
    expect((await orc.formParties({ ...input, useModel: false })).source).toBe("template");
  });

  it("a squad that cannot actually meet is never formed, whoever proposed it", async () => {
    const m = adults.slice(0, 6);
    const circle = { id: "c1", theme: "", members: m };
    const table = [
      { id: "prop-" + m[0], by: m[0], members: [m[0], m[1], m[2]], line: "", backers: [m[1], m[2]] },
      { id: "prop-" + m[3], by: m[3], members: [m[0], m[3], m[4]], line: "", backers: [m[4]] },
    ];
    const want = orc.wanted(table, new Map([[m[1], { action: "back", proposalId: "prop-" + m[0] }], [m[2], { action: "back", proposalId: "prop-" + m[0] }], [m[4], { action: "back", proposalId: "prop-" + m[3] }]]));
    const cannotMeet = (g: string[]) => !(g.includes(m[0]) && g.includes(m[1])); // m0 and m1 share no free time
    const base = { circle, table, want, verdicts: verdicts(m), people, targetSize: 3, exclude: [], feasible: cannotMeet };
    expect(orc.validateParties([{ members: [m[0], m[1], m[2]], why: "" }], m, want, people, 3, [], cannotMeet)).toEqual([]);
    expect(orc.composeParties({ ...base, priority: [m[0]] })[0].members).toEqual([m[0], m[3], m[4]]);
    mockProvider().on("orchestrator_form", () => JSON.stringify({ parties: [{ members: [m[0], m[1], m[2]], why: "The most backed group." }] }));
    const out = await orc.formParties({ ...base, briefs: briefs(m), attempt: 1, useModel: true, priority: [m[0]] });
    expect(out.parties.map((p) => p.members)).toEqual([[m[0], m[3], m[4]]]);
  });

  it("composeParties avoids a squad someone would decline at sign-off when there is another option", () => {
    const m = adults.slice(0, 5);
    const vs = verdicts(m, 60);
    vs.get(m[1])!.set(m[2], v(10)); // m1 would decline a squad with m2
    const table = [{ id: "prop-" + m[0], by: m[0], members: [m[0], m[1], m[2]], line: "", backers: [] }];
    const want = new Map([[m[0], new Set(m.slice(1))]]);
    const out = orc.composeParties({ circle: { id: "c1", theme: "", members: m }, table, want, verdicts: vs, people, targetSize: 3, exclude: [], priority: [m[0]], onlyPriority: true });
    expect(out).toHaveLength(1);
    expect(out[0].members.includes(m[1]) && out[0].members.includes(m[2])).toBe(false);
  });

  it("composeParties places priority people first and can combine overlapping proposals", () => {
    const m = adults.slice(0, 7);
    const circle = { id: "c1", theme: "", members: m };
    // three different proposals that overlap; nobody proposed exactly the same group
    const table = [
      { id: "prop-" + m[0], by: m[0], members: [m[0], m[1], m[2]], line: "", backers: [] },
      { id: "prop-" + m[1], by: m[1], members: [m[1], m[2], m[3]], line: "", backers: [] },
      { id: "prop-" + m[6], by: m[6], members: [m[6], m[4], m[5]], line: "", backers: [] },
    ];
    const want = orc.wanted(table, new Map());
    const base = { circle, table, want, verdicts: verdicts(m), people, targetSize: 3, exclude: [] };
    const all = orc.composeParties(base);
    expect(all.map((p) => p.members)).toContainEqual([m[0], m[1], m[2]]);
    expect(all.map((p) => p.members)).toContainEqual([m[4], m[5], m[6]]);
    const only = orc.composeParties({ ...base, priority: [m[6]], onlyPriority: true });
    expect(only.map((p) => p.members)).toEqual([[m[4], m[5], m[6]]]);
    expect(orc.composeParties({ ...base, priority: [m[6]], onlyPriority: true, exclude: [[m[4], m[5], m[6]]] })).toEqual([]);
  });
});
