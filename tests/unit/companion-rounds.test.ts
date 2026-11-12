import { beforeEach, describe, expect, it } from "vitest";
import { mockProvider } from "@/lib/ai";
import { openView, privateTexts, sourceFacts, templateBrief } from "@/lib/companion/brief";
import * as rounds from "@/lib/companion/rounds";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const qctx = { mode: "events" as const, eventTitle: "Indie Night", targetSize: 4 };
const circle = [...people.values()].filter((p) => p.ageBand === "18-24" && !p.womenOnlyParty && p.blocked.size === 0).map((p) => p.id).sort().slice(0, 6);
const me = circle[0];
const others = circle.slice(1);
const briefs = new Map(circle.map((i) => [i, templateBrief(people.get(i)!, qctx)]));
const intros = new Map(others.map((i) => [i, openView(briefs.get(i)!)]));
const ctx = (over: Partial<rounds.RoundCtx> = {}): rounds.RoundCtx => ({ brief: briefs.get(me)!, me: people.get(me)!, people, othersPrivate: new Map(), useModel: true, ...over });
const firstName = (id: string) => people.get(id)!.name.split(" ")[0];

describe("companion rounds", () => {
  beforeEach(() => mockProvider().reset());

  it("first names in this circle are unique (the name mapping test relies on it)", () => {
    expect(new Set(circle.map(firstName)).size).toBe(circle.length);
  });

  it("askRound falls back to one question per circle-mate", async () => {
    const out = await rounds.askRound(ctx(), intros);
    expect([...out.asks.keys()].sort()).toEqual(others);
    expect([...out.asks.values()].every((m) => m.say.trim().endsWith("?") && !m.blocked)).toBe(true);
    expect(out.source).toBe("fallback");
  });

  it("a partial reply is topped up; first names map to ids; self and unknown ids are dropped", async () => {
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: { [firstName(others[0])]: { say: "What do they do at 11pm?", cites: [] }, [me]: { say: "self?", cites: [] }, ghost: { say: "x?", cites: [] } } }));
    const out = await rounds.askRound(ctx(), intros);
    expect([...out.asks.keys()].sort()).toEqual(others);
    expect(out.asks.get(others[0])!.say).toBe("What do they do at 11pm?");
    expect(out.asks.get(others[1])!.say).not.toBe("self?");
    expect(out.source).toBe("mock");
  });

  it("the prompt holds this Companion's brief and only open views of the others", async () => {
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: {} }));
    const hidden = sourceFacts(people.get(others[0])!)[0];
    const b2 = new Map(briefs).set(others[0], templateBrief(people.get(others[0])!, qctx, { [hidden.id]: "private" }));
    const i2 = new Map(others.map((i) => [i, openView(b2.get(i)!)]));
    const out = await rounds.askRound(ctx({ othersPrivate: new Map([[others[0], privateTexts(b2.get(others[0])!)]]) }), i2);
    expect(out.audit).toEqual([]);
    const prompt = mockProvider().calls[0].messages[1].content;
    expect(JSON.stringify(JSON.parse(prompt).circle_mates.find((m: { id: string }) => m.id === others[0]))).not.toContain(hidden.text);
    expect(JSON.parse(prompt).your_brief.ownerId).toBe(me);
    expect(prompt.match(/"ownerId"/g)).toHaveLength(1);
    expect(prompt).not.toContain('"source"');
  });

  it("answerRound gives a clamped verdict per person and at most 4 picks", async () => {
    mockProvider().on("companion_answer", () => JSON.stringify({ answers: {}, verdicts: Object.fromEntries(others.map((o) => [o, { score: 400, wouldEnjoy: ["Both go to church"], opener: "Hi" }])), picks: [me, ...others] }));
    const out = await rounds.answerRound(ctx(), intros, new Map(others.map((o) => [o, "What would they do?"])));
    expect([...out.verdicts.keys()].sort()).toEqual(others);
    expect([...out.verdicts.values()].every((x) => x.score === 100)).toBe(true);
    expect(JSON.stringify([...out.verdicts.values()])).not.toMatch(/church/);
    expect([...out.verdicts.values()].every((x) => x.wouldEnjoy.length >= 1)).toBe(true);
    expect(out.picks).toHaveLength(4);
    expect(out.picks).not.toContain(me);
    expect([...out.answers.keys()].sort()).toEqual(others);
  });

  it("private text in a reply is blocked; citing someone else's fact is dropped, not blocked", async () => {
    const hidden = sourceFacts(people.get(me)!)[0];
    const mine = templateBrief(people.get(me)!, qctx, { [hidden.id]: "private" });
    const theirs = intros.get(others[1])!.facts[0].id;
    mockProvider().on("companion_ask", () => JSON.stringify({ asks: {
      [others[0]]: { say: `They are into ${hidden.text}. Yours?`, cites: [] },
      [others[1]]: { say: "Yours is into that too, right?", cites: [theirs] },
      [others[2]]: { say: "Would yours join?", cites: [hidden.id] },
    } }));
    const out = await rounds.askRound(ctx({ brief: mine }), intros);
    expect(out.asks.get(others[0])!.blocked).toBe(true);
    expect(out.asks.get(others[0])!.say).not.toContain(hidden.text);
    expect(out.asks.get(others[1])).toMatchObject({ blocked: false, cites: [] });
    expect(out.asks.get(others[2])!.blocked).toBe(true);
  });

  it("an audit failure skips the call", async () => {
    const leaked = "zz-private-phrase";
    const bad = new Map(intros).set(others[0], { ...intros.get(others[0])!, communication: leaked });
    const out = await rounds.askRound(ctx({ othersPrivate: new Map([[others[0], [leaked]]]) }), bad);
    expect(out.audit).toEqual([leaked]);
    expect(mockProvider().calls).toHaveLength(0);
    expect([...out.asks.keys()].sort()).toEqual(others);
  });

  it("the same text is fine when it is a different person's open fact", async () => {
    // a fact others[1] shares openly, which others[0] (who does not list it) marked private
    const mine0 = new Set(intros.get(others[0])!.facts.map((f) => f.text));
    const shared = intros.get(others[1])!.facts.find((f) => !mine0.has(f.text))!.text;
    const out = await rounds.askRound(ctx({ othersPrivate: new Map([[others[0], [shared]]]) }), intros);
    expect(out.audit).toEqual([]);
  });

  it("closeRound repairs a bad proposal to exactly targetSize including the owner", async () => {
    mockProvider().on("companion_close", () => JSON.stringify({ says: {}, verdicts: {}, proposal: { members: [others[0], "ghost"] } }));
    const vs = new Map(others.map((o) => [o, rounds.fallbackVerdict(people.get(me)!, people.get(o)!)]));
    const out = await rounds.closeRound(ctx(), new Map(), circle, vs, 4);
    expect(out.proposal.members).toHaveLength(4);
    expect(out.proposal.members).toContain(me);
    expect(out.proposal.members).toContain(others[0]);
    expect(new Set(out.proposal.members).size).toBe(4);
    expect(out.proposal.members.every((x) => circle.includes(x))).toBe(true);
    expect(out.says.size).toBe(0);
  });

  it("deep-dive rounds answer every deep partner and skip the call when there are none", async () => {
    const thread = (o: string): rounds.ThreadMsg[] => [{ from: o, to: me, kind: "answer", say: "They'd stay late.", cites: [], blocked: false }];
    const threads = new Map(others.slice(0, 2).map((o) => [o, thread(o)]));
    const f = await rounds.followUpRound(ctx(), threads);
    expect([...f.says.keys()].sort()).toEqual(others.slice(0, 2));
    const cl = await rounds.closeRound(ctx(), threads, circle, new Map(), 4);
    expect([...cl.says.keys()].sort()).toEqual(others.slice(0, 2));
    expect([...cl.verdicts.keys()].sort()).toEqual(others.slice(0, 2));
    mockProvider().reset();
    expect((await rounds.followUpRound(ctx(), new Map())).says.size).toBe(0);
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("deliberate: backs a valid proposal, ignores one that leaves its person out, turns a duplicate amend into a back", async () => {
    const table = [
      { id: "prop-" + me, by: me, members: [me, others[0], others[1], others[2]], line: "mine", backers: [] },
      { id: "prop-" + others[3], by: others[3], members: [me, others[2], others[3], others[4]], line: "x", backers: [] },
      { id: "prop-" + others[4], by: others[4], members: others.slice(1, 5), line: "y", backers: [] },
    ];
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "back", proposalId: "prop-" + others[3] }));
    expect(await rounds.deliberate(ctx(), table, new Map(), 4)).toMatchObject({ action: "back", proposalId: "prop-" + others[3] });
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "back", proposalId: "prop-" + others[4] }));
    expect((await rounds.deliberate(ctx(), table, new Map(), 4)).proposalId).not.toBe("prop-" + others[4]);
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "amend", members: [others[4], others[3], others[2], me] }));
    expect(await rounds.deliberate(ctx(), table, new Map(), 4)).toMatchObject({ action: "back", proposalId: "prop-" + others[3] });
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "amend", members: [me, others[0], others[3], others[4]] }));
    const am = await rounds.deliberate(ctx(), table, new Map(), 4);
    expect(am.action).toBe("amend");
    expect(am.members).toEqual([me, others[0], others[3], others[4]].sort());
  });

  it("deliberate and groupRespond return valid enums on garbage output; useModel false makes no call", async () => {
    mockProvider().on("companion_deliberate", () => JSON.stringify({ action: "shout" }));
    mockProvider().on("companion_group2", () => "definitely!");
    const table = [{ id: "prop-" + others[0], by: others[0], members: [me, ...others.slice(0, 3)], line: "x", backers: [] }];
    expect(["back", "amend", "hold"]).toContain((await rounds.deliberate(ctx(), table, new Map(), 4)).action);
    expect(["yes", "yes_if", "no"]).toContain((await rounds.groupRespond(ctx(), circle.slice(0, 4), [], new Map())).decision);
    mockProvider().reset();
    expect((await rounds.askRound(ctx({ useModel: false }), intros)).source).toBe("template");
    expect((await rounds.groupSpeak(ctx({ useModel: false }), circle.slice(0, 4), intros, new Map())).line.blocked).toBe(false);
    expect(mockProvider().calls).toHaveLength(0);
  });

  it("groupRespond: a model 'no' is kept with its reason private; yes_if carries a need", async () => {
    mockProvider().on("companion_group2", () => JSON.stringify({ line: { say: "Thanks, everyone.", cites: [] }, decision: "no", privateReason: "not a fit" }));
    const no = await rounds.groupRespond(ctx(), circle.slice(0, 4), [], new Map());
    expect(no).toMatchObject({ decision: "no", privateReason: "not a fit" });
    expect(no.line.say).toBe("Thanks, everyone.");
    mockProvider().on("companion_group2", () => JSON.stringify({ line: { say: "Sounds good.", cites: [] }, decision: "yes_if", need: "somewhere we can hear each other" }));
    expect(await rounds.groupRespond(ctx(), circle.slice(0, 4), [], new Map())).toMatchObject({ decision: "yes_if", need: "somewhere we can hear each other" });
  });
});
