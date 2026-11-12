import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { Trace } from "@/contracts";
import { runParty } from "@/lib/agents/orchestrator";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { stageView } from "@/lib/server/views";
import { boardAt, replayDelay } from "@/lib/stage/board";
import { flag } from "@/lib/flags";

let traces: Trace[] = [];
const NIGHT = `plan-${D.expectedPlanEventId}`;

beforeAll(async () => {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  traces = stageView(pid).traces;
});

describe("stage board (F1)", () => {
  it("is on by default", () => {
    expect(flag("STAGE_SCRUBBER")).toBe(true);
  });

  it("every trace satisfies the contract", () => {
    for (const t of traces) expect(Trace.safeParse(t).success).toBe(true);
  });

  it("at the end: three plans out, the Night Market locked, five signatures", () => {
    const b = boardAt(traces, traces.length);
    expect(b.unavailable.sort()).toEqual(["plan-evt-rooftop", "plan-evt-supper", "plan-evt-synth"]);
    expect(b.locked).toBe(NIGHT);
    expect(Object.values(b.signatures).filter((s) => s === "signed" || s === "conceded")).toHaveLength(5);
    expect(b.signatures.kai).toBe("conceded");
    expect(b.done).toBe(true);
  });

  it("at the start nothing has happened", () => {
    const b = boardAt(traces, 0);
    expect(b).toMatchObject({ round: 0, unavailable: [], leading: null, locked: null, done: false });
  });

  it("rewinds to round 2: Kai is holding and nothing is locked", () => {
    const lastRound2 = traces.findLastIndex((t) => t.meta?.kind === "verdicts" && t.meta.round === 2);
    const b = boardAt(traces, lastRound2 + 1);
    expect(b.round).toBe(2);
    expect(b.leading).toBe(NIGHT);
    expect(b.locked).toBeNull();
    expect(b.signatures.kai).toBe("holding");
    expect(Object.values(b.signatures).filter((s) => s === "signed")).toHaveLength(4);
  });

  it("code rejections are red: unavailable marks and rejecting agents carry the reject tone", () => {
    const red = traces.filter((t) => t.tone === "reject");
    expect(red.filter((t) => t.meta?.kind === "unavailable")).toHaveLength(3);
    expect(red.filter((t) => t.meta?.kind === "verdicts").map((t) => t.actorId).sort()).toEqual(["ana", "dev", "maya", "zoe"]);
    expect(boardAt(traces, traces.length).rejections).toBe(4);
  });

  it("replay delays follow the recording, clamped", () => {
    expect(replayDelay(traces, 0, 1)).toBeGreaterThanOrEqual(60);
    expect(replayDelay(traces, 0, 1)).toBeLessThanOrEqual(1500);
    expect(replayDelay(traces, traces.length, 2)).toBe(200);
  });
});
