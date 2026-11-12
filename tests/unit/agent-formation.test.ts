import { beforeEach, describe, expect, it } from "vitest";
import LANDMARKS from "@/data/seed/landmarks.json";
import { mockProvider } from "@/lib/ai";
import { partyFormationAgent } from "@/lib/agents/partyFormation";
import { findProposal, type Candidate, type Proposal, type QueueItem } from "@/lib/match/engine";
import { groupCohesion } from "@/lib/match/cohesion";
import { makePairScorer } from "@/lib/match/compat";
import { VOCAB } from "@/lib/graph/vocabulary";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const landmarks = new Map(LANDMARKS.map((l) => [l.id, l]));
const item = (userId: string): QueueItem => ({ entryId: `e-${userId}`, userId, targetSize: 4, bucketId: "lm-downtown-pa", eventId: null, joinedAt: 0, isSimulated: true });

const cand = (ids: string[]): Candidate => ({ entryIds: ids.map((i) => `e-${i}`), userIds: ids, eventId: null, cohesion: groupCohesion(ids.map((i) => people.get(i)!)) });

function proposal(): Proposal {
  // engine proposal for Me, plus two alternative safe groups so the agent has a real choice
  const pool = ["p01", "p02", "p03", "p05", "p06", "p11", "p12", "p14"].map(item);
  const p = findProposal(pool[0], pool, people, landmarks, { now: 0, fillMode: "simulated" }, makePairScorer());
  expect(p).not.toBeNull();
  p!.candidates.push(cand(["p01", "p02", "p06", "p12"]), cand(["p01", "p03", "p11", "p14"]));
  return p!;
}

function unsafeCandidate(): Candidate {
  const ids = ["p01", "p09", "p03", "p05"]; // Me blocked p09
  return { entryIds: ids.map((i) => `e-${i}`), userIds: ids, eventId: null, cohesion: groupCohesion(ids.map((i) => people.get(i)!)) };
}

describe("Party Formation Agent", () => {
  beforeEach(() => mockProvider().reset());

  it("follows the model's (safe) pick and records a full tool trace", async () => {
    mockProvider().on("party_formation", () => JSON.stringify({ choice: 1, rationale: "You all climb and love indie shows." }));
    const p = proposal();
    const r = await partyFormationAgent(p, people);
    expect(r.candidate).toBe(p.candidates[1]);
    expect(r.rationale).toBe("You all climb and love indie shows.");
    expect(r.source).toBe("mock");
    const tools = r.steps.filter((s) => s.kind === "tool_call").map((s) => s.toolName);
    expect(tools).toContain("getProfiles");
    expect(tools.filter((t) => t === "scoreGroup")).toHaveLength(p.candidates.length);
    expect(tools.filter((t) => t === "checkSafetyRules")).toHaveLength(p.candidates.length);
    expect(r.steps.map((s) => s.kind)).toEqual(expect.arrayContaining(["reasoning", "safety_check", "decision"]));
    expect(r.steps.at(-1)!.kind).toBe("decision");
  });

  it("rejects an agent pick that violates safety and falls back to a safe group", async () => {
    const p = proposal();
    p.candidates.unshift(unsafeCandidate()); // index 0 is unsafe
    mockProvider().on("party_formation", () => JSON.stringify({ choice: 0, rationale: "Pick the first one." }));
    const r = await partyFormationAgent(p, people);
    expect(r.candidate.userIds).not.toContain("p09");
    expect(r.steps.find((s) => s.kind === "safety_check")!.output).toMatchObject({ rejected: true });
    expect(r.steps.find((s) => s.toolName === "checkSafetyRules")!.summary).toMatch(/violates blocked/);
  });

  it("rejects out-of-range picks and survives garbage output (fallback)", async () => {
    mockProvider().on("party_formation", () => JSON.stringify({ choice: 99, rationale: "Group 99 obviously." }));
    const p = proposal();
    expect((await partyFormationAgent(p, people)).candidate).toBe(p.candidates[0]);
    mockProvider().on("party_formation", () => "sure! I pick B");
    const r = await partyFormationAgent(p, people);
    expect(r.source).toBe("fallback");
    expect(r.candidate).toBe(p.candidates[0]);
    expect(r.rationale).toMatch(/Everyone here shares/);
  });

  it("never sends sensitive data to the model", async () => {
    mockProvider().on("party_formation", () => JSON.stringify({ choice: 0, rationale: "ok then fine" }));
    const p = proposal();
    p.candidates[0].userIds.push("p03"); // p03 has a planted sensitive like
    await partyFormationAgent(p, people);
    const prompt = mockProvider().calls.map((c) => c.messages.map((m) => m.content).join("\n")).join("\n");
    for (const v of VOCAB.filter((x) => x.sensitive)) for (const name of [...v.pages, ...(v.groups ?? [])]) expect(prompt).not.toContain(name);
  });

  it("makes exactly one model call per party", async () => {
    mockProvider().on("party_formation", () => JSON.stringify({ choice: 0, rationale: "ok then fine" }));
    await partyFormationAgent(proposal(), people);
    expect(mockProvider().calls).toHaveLength(1);
  });
});
