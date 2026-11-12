import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { submitPicks } from "@/lib/server/after";
import { markSeen, notificationsFor, unreadCount } from "@/lib/server/notifications";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { askToSwitch } from "@/lib/server/switchplan";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

describe("notifications, kept (F58)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("NOTIFICATIONS_LIST")).toBe(true));

  it("Maya's list: forming and MATCH FOUND, newest first, in the toasts' words; seen resets the count; a switch adds one", async () => {
    const pid = await locked();
    const list = notificationsFor("maya").map((n) => n.text);
    expect(list[0]).toMatch(/^MATCH FOUND: Dolores Night Market, 6 PM · /);
    expect(list).toContain("Your party of five is forming. Your agents are talking it over.");
    expect(unreadCount("maya")).toBe(list.length);
    markSeen("maya");
    expect(unreadCount("maya")).toBe(0);
    for (const id of ["maya", "dev", "kai"]) askToSwitch(pid, id);
    expect(unreadCount("maya")).toBe(1);
    expect(notificationsFor("maya")[0]!.text).toBe("Your party switched to plan B. Your RSVP moved.");
  });

  it("only what you were sent: a mutual pick between Maya and Ana isn't in Dev's list", async () => {
    const pid = await locked();
    submitPicks(pid, "maya", ["ana"]);
    submitPicks(pid, "ana", ["maya"]);
    expect(notificationsFor("maya").map((n) => n.text)).toContain("Run it back: you and Ana both said yes.");
    expect(notificationsFor("dev").some((n) => n.text.startsWith("Run it back"))).toBe(false);
  });
});
