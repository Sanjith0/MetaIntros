import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { ownerChecks } from "@/lib/agents/judge";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { arrive } from "@/lib/server/door";
import { joinQueue } from "@/lib/server/queue";
import { cantMakeIt, hasDropped } from "@/lib/server/refill";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}
const waitNearby = (id: string, sentence: string) => joinQueue({ userId: id, eventId: D.entryEventId, sentence, consentBridges: true, startTalk: false });

describe("can't make it after the lock (F42)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("SEAT_REFILL")).toBe(true));

  it("someone waiting nearby whose rules pass the plan takes the seat; the others are told nothing about who left", async () => {
    const pid = await locked();
    await waitNearby("sam", "anything chill works for me");
    const r = await cantMakeIt(pid, "maya");
    expect(r.joined).toBe("sam");
    const s = store();
    const party = s.parties.get(pid)!;
    expect(party.memberIds).toHaveLength(5);
    expect(party.memberIds).toContain("sam");
    expect(party.memberIds).not.toContain("maya");
    expect(party.status).toBe("locked");
    expect(ownerChecks(pid, s.plans.get(party.planId!)!, s.briefs.get("brief-sam")!).every((c) => c.pass)).toBe(true);
    // Cards both ways between Sam and each of the four; none left for Maya.
    expect(s.cards.filter((c) => c.partyId === pid && c.viewerId === "sam")).toHaveLength(4);
    expect(s.cards.filter((c) => c.partyId === pid && c.subjectId === "sam")).toHaveLength(4);
    expect(s.cards.some((c) => c.partyId === pid && (c.viewerId === "maya" || c.subjectId === "maya"))).toBe(false);
    // The chat: Sam in, Maya out, one line that names only the newcomer, and Sam's opener.
    const chat = s.chats.get(party.chatId!)!;
    expect(chat.memberIds).toContain("sam");
    expect(chat.memberIds).not.toContain("maya");
    const lines = s.messages.filter((m) => m.chatId === chat.id).slice(-2);
    expect(lines[0]!.text).toBe("One person couldn't make it. Sam is taking the seat.");
    expect(lines[1]).toMatchObject({ senderId: "sam", kind: "opener" });
    // The event the four get has no name and no reason; Sam gets MATCH FOUND.
    const seat = s.events_log.filter((e) => e.type === "party.seat");
    expect(seat.map((e) => e.payload)).toEqual([{ partyId: pid, refilled: true }]);
    expect(seat[0]!.audience).toEqual({ kind: "users", userIds: ["dev", "ana", "kai", "zoe"] });
    expect(s.events_log.filter((e) => e.type === "match.found").at(-1)!.audience).toEqual({ kind: "users", userIds: ["sam"] });
    for (const t of s.traces.filter((x) => x.partyId === pid && x.meta?.kind === "seat")) expect(`${t.title} ${t.body}`).not.toContain("Maya");
  });

  it("someone whose own rules break the plan is passed over; with nobody else, the plan stands for four", async () => {
    const pid = await locked();
    await waitNearby("sam", "anything, but done by nine"); // the market ends at 10
    const r = await cantMakeIt(pid, "maya");
    expect(r.joined).toBeNull();
    expect(hasDropped(pid, "maya")).toBe(true);
    const s = store();
    expect(s.messages.filter((m) => m.chatId === s.parties.get(pid)!.chatId).at(-1)!.text).toBe("One person can't make it. The plan stands.");
    expect(s.events_log.filter((e) => e.type === "party.seat").map((e) => e.payload)).toEqual([{ partyId: pid, refilled: false }]);
    await expect(cantMakeIt(pid, "maya")).rejects.toThrow("already said");
  });

  it("not before the lock, not once you're there, not for someone outside the party", async () => {
    resetStore();
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const early = [...store().parties.keys()][0]!;
    await expect(cantMakeIt(early, "maya")).rejects.toThrow("Your plan isn't set yet");
    const pid = await locked();
    arrive(pid, "dev");
    await expect(cantMakeIt(pid, "dev")).rejects.toThrow("You're already there.");
    await expect(cantMakeIt(pid, "priya")).rejects.toThrow("not in this party");
  });
});
