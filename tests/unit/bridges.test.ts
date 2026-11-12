import { afterEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { everythingVisibleTo } from "@/lib/server/secret";
import { resetStore, store } from "@/lib/server/store";
import { memberPartyView } from "@/lib/server/views";

async function party(ids: string[], opts: { duo?: [string, string]; noConsent?: string[] } = {}) {
  process.env.PQ_PACE_MS = "0";
  resetStore();
  for (const id of ids) {
    const duoWith = opts.duo?.[0] === id ? opts.duo[1] : opts.duo?.[1] === id ? opts.duo[0] : null;
    await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id] ?? "podcasts and a walk, home by eleven", consentBridges: !opts.noConsent?.includes(id), duoWith, startTalk: false });
  }
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}

const line = (pid: string, viewer: string, subject: string) => memberPartyView(pid, viewer)!.members.find((m) => m.id === subject)!.bridge;

afterEach(() => {
  delete process.env.PQ_FLAG_BRIDGE_PRIVACY;
});

describe("bridge lines (F7)", () => {
  it("is on by default", () => expect(flag("BRIDGE_PRIVACY")).toBe(true));

  it("a mutual friend outside the party is never named", async () => {
    const pid = await party(["dev", "ana", "kai", "zoe", "maya"]);
    expect(line(pid, "maya", "dev")).toBe("You have a friend in common."); // Priya, who never opted in
    expect(line(pid, "dev", "kai")).toBe("You have a friend in common."); // Theo
  });

  it("a small Group is named: it is not a person, and both are in it", async () => {
    const pid = await party(["dev", "ana", "kai", "zoe", "maya"]);
    expect(line(pid, "maya", "zoe")).toBe("You're both in Portuguese Practice SF.");
    expect(line(pid, "ana", "zoe")).toBe("You're both in Mission Ceramics Collective.");
  });

  it("nobody in the party can load the name of anyone outside it", async () => {
    const pid = await party(["dev", "ana", "kai", "zoe", "maya"]);
    const members = new Set(store().parties.get(pid)!.memberIds);
    const outsiders = [...store().profiles.values()].filter((p) => !members.has(p.id)).map((p) => p.name);
    for (const m of members) {
      const seen = everythingVisibleTo(pid, m).text;
      for (const name of outsiders) expect(seen, `${m} sees ${name}`).not.toContain(name);
    }
    // Nor their ids: every source id a member can see is free of outsiders' ids.
    const outsiderIds = [...store().profiles.values()].filter((p) => !members.has(p.id)).map((p) => p.id);
    for (const m of members) {
      const v = memberPartyView(pid, m)!;
      const ids = [...v.cards.flatMap((c) => c.sourceIds), ...v.pairs.flatMap((p) => p.sourceIds), ...v.table.flatMap((t) => t.sourceIds)];
      for (const id of ids) for (const o of outsiderIds) expect(id.split(/[-|]/), `${m} sees id ${id}`).not.toContain(o);
    }
  });

  it("a mutual friend who is in the party and agreed to show connections can be named", async () => {
    const pid = await party(["dev", "ana", "kai", "zoe", "sam"], { duo: ["zoe", "sam"] });
    expect(line(pid, "zoe", "sam")).toBe("You queued together.");
    // Ana and Zoe both know Sam, who is right here and opted in: he can be named.
    expect(line(pid, "ana", "zoe")).toBe("You both know Sam Whitfield.");
  });

  it("a party member who did not opt in is not named either", async () => {
    const pid = await party(["dev", "ana", "kai", "zoe", "sam"], { duo: ["zoe", "sam"], noConsent: ["sam"] });
    expect(JSON.stringify(memberPartyView(pid, "ana"))).not.toContain("You both know Sam");
  });

  it("with the flag off, the old named lines come back", async () => {
    process.env.PQ_FLAG_BRIDGE_PRIVACY = "0";
    const pid = await party(["dev", "ana", "kai", "zoe", "maya"]);
    expect(line(pid, "maya", "dev")).toBe("You both know Priya Natarajan.");
  });
});
