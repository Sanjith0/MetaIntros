import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue, queueStatus, updateSentence } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const join = (id: string, sentence = D.sentences[id]!) => joinQueue({ userId: id, eventId: D.entryEventId, sentence, consentBridges: true, startTalk: false });

describe("change your sentence while you wait (F34)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
  });

  it("is on by default", () => expect(flag("EDIT_SENTENCE")).toBe(true));

  it("rebuilds the brief from the new words and keeps the same entry, so the same place in line", async () => {
    await join("maya");
    await join("dev");
    const before = queueStatus("maya")!.entry;
    expect(store().briefs.get("brief-maya")!.hardRules.map((r) => r.kind).sort()).toEqual(["end_by", "max_price", "no_drink_minimum"]);
    await updateSentence("maya", "chill people, out by eleven, under twenty bucks");
    const after = queueStatus("maya")!;
    expect(after.entry.id).toBe(before.id);
    expect(after.entry.joinedAt).toBe(before.joinedAt); // ahead of Dev still
    expect(after.sentence).toBe("chill people, out by eleven, under twenty bucks");
    expect(store().briefs.get("brief-maya")!.hardRules.map((r) => r.kind).sort()).toEqual(["end_by", "max_price"]);
    expect(store().queue.filter((e) => e.userId === "maya")).toHaveLength(1);
  });

  it("the agents use the new brief: without the drink rule, Maya's agent no longer turns the rooftop down", async () => {
    await join("maya");
    await updateSentence("maya", "chill people, out by eleven, under twenty bucks");
    for (const id of ["dev", "ana", "kai", "zoe"]) await join(id);
    const pid = [...store().parties.keys()][0]!;
    await runParty(pid, { paceMs: 0 });
    const rooftop = store().verdicts.find((v) => v.ownerId === "maya" && v.round === 1 && v.planId === "plan-evt-rooftop")!;
    expect(rooftop.decision).not.toBe("reject");
  });

  it("only while waiting: once the party forms, the agents already have the brief", async () => {
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) await join(id);
    await expect(updateSentence("maya", "anything goes")).rejects.toThrow("You can change your sentence while you're waiting.");
    await expect(updateSentence("priya", "anything goes")).rejects.toThrow("while you're waiting");
  });
});
