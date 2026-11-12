import { describe, expect, it } from "vitest";
import type os from "node:os";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { acksFor, connect, connected, lanAddress, recordAck } from "@/lib/server/phones";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const iface = (address: string, internal = false, family = "IPv4") => ({ address, internal, family }) as os.NetworkInterfaceInfo;

describe("real phones (F3)", () => {
  it("is on by default", () => expect(flag("REAL_PHONES")).toBe(true));

  it("counts a phone as live while any of its connections is open", () => {
    const a = connect("test-phone");
    const b = connect("test-phone");
    expect(connected("test-phone")).toBe(true);
    a();
    a(); // closing twice is harmless
    expect(connected("test-phone")).toBe(true);
    b();
    expect(connected("test-phone")).toBe(false);
  });

  it("picks the private Wi-Fi address for the QR links", () => {
    expect(lanAddress({ lo0: [iface("127.0.0.1", true)], en0: [iface("192.168.1.42")], utun: [iface("100.64.0.3")] })).toBe("192.168.1.42");
    expect(lanAddress({ en0: [iface("169.254.3.3")], en1: [iface("10.0.0.7")] })).toBe("10.0.0.7");
    expect(lanAddress({ lo0: [iface("127.0.0.1", true)], en0: [iface("fe80::1", false, "IPv6")] })).toBeNull();
  });

  it("records each phone's MATCH FOUND lag in server time, members only, after the lock", async () => {
    process.env.PQ_PACE_MS = "0";
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
      await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    }
    const pid = [...store().parties.keys()][0]!;
    expect(recordAck({ userId: "maya", partyId: pid, shownAt: Date.now(), sound: "played", vibrate: "yes" })).toBeNull(); // not locked yet
    await runParty(pid, { paceMs: 0 });
    const locked = Date.parse(store().parties.get(pid)!.lockedAt!);
    expect(recordAck({ userId: "maya", partyId: pid, shownAt: locked + 140, sound: "played", vibrate: "yes" })!.lagMs).toBe(140);
    expect(recordAck({ userId: "maya", partyId: pid, shownAt: locked + 90, sound: "played", vibrate: "yes" })!.lagMs).toBe(90); // replaces
    expect(recordAck({ userId: "priya", partyId: pid, shownAt: locked, sound: "played", vibrate: "yes" })).toBeNull();
    expect(acksFor(pid)).toHaveLength(1);
  });
});
