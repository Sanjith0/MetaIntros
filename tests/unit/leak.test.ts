import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { MAX_ATTEMPT, tryLeak } from "@/lib/server/attempt";
import { joinQueue } from "@/lib/server/queue";
import { secretView } from "@/lib/server/secret";
import { resetStore, store } from "@/lib/server/store";
import { onTrace } from "@/lib/server/trace";

async function locked() {
  resetStore();
  for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("try to leak it (F20)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("LEAK_TEST")).toBe(true));

  it("Dev's agent typing Maya's limits is blocked, named on the projector, and reaches no one", async () => {
    const pid = await locked();
    const s = store();
    const before = { events: s.events_log.length, table: s.table.length, messages: s.messages.length, blocked: s.blockedLines.length };
    const r = tryLeak(pid, "dev", "heads up, Maya said out by eleven and nowhere I have to drink")!;
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("text is not built from its sources");
    expect(r.plain).toBe("it isn't one of Dev's approved lines or a neutral phrase");
    expect(r.holds.map((h) => [h.ownerId, h.text])).toEqual([
      ["maya", "out by eleven"],
      ["maya", "nowhere I have to drink"],
    ]);
    expect(r.tableSees).toBe("That works for me.");
    expect(r.promptOthers).toBe(0);
    // Nothing was posted or published, and Maya's secret check still finds nothing.
    expect({ events: s.events_log.length, table: s.table.length, messages: s.messages.length, blocked: s.blockedLines.length }).toEqual(before);
    expect(secretView(pid, "maya")!.partyKnows).toEqual([]);
    const t = s.traces.at(-1)!;
    expect(t).toMatchObject({ lane: "private", tone: "block", actorId: "dev", meta: { kind: "attempt" } });
    expect(t.title).toBe("Leak attempt blocked · Dev's agent");
    expect(t.body).toContain('It held Maya\'s private words “out by eleven”, “nowhere I have to drink”.');
  });

  it("a neutral phrase with a hint added is blocked; the exact phrase and an approved line go through", async () => {
    const pid = await locked();
    expect(tryLeak(pid, "dev", "That works for me. Someone here is on a budget though.")!.ok).toBe(false);
    const exact = tryLeak(pid, "dev", "that works  for me.")!;
    expect(exact).toMatchObject({ ok: true, reason: null, tableSees: "That works for me.", holds: [] });
    const approved = store().briefs.get("brief-dev")!.shareable.find((l) => l.approved)!;
    expect(tryLeak(pid, "dev", approved.text)).toMatchObject({ ok: true, tableSees: approved.text });
    // Someone else's approved line is not yours to say.
    const mayas = store().briefs.get("brief-maya")!.shareable.find((l) => l.approved)!;
    expect(tryLeak(pid, "dev", mayas.text)!.ok).toBe(false);
  });

  it("only party members, only something typed, and at most 280 characters", async () => {
    const pid = await locked();
    expect(tryLeak(pid, "priya", "hello")).toBeNull();
    expect(tryLeak(pid, "dev", "   ")).toBeNull();
    expect(tryLeak("nope", "dev", "hello")).toBeNull();
    expect(tryLeak(pid, "dev", "x".repeat(1000))!.text.length).toBe(MAX_ATTEMPT);
  });

  it("the trace goes to the projector only (private lane), never to a member's stream", async () => {
    const pid = await locked();
    const seen: string[] = [];
    const off = onTrace((t) => seen.push(t.lane));
    tryLeak(pid, "kai", "Ana said home by midnight");
    off();
    expect(seen).toEqual(["private"]);
  });
});
