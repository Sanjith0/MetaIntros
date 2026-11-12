import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";
import { agentStory } from "@/lib/server/story";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked(sentences: Record<string, string> = {}) {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: sentences[id] ?? D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}
const texts = (pid: string, id: string) => agentStory(pid, id)!.map((s) => `${s.round ?? "L"}|${s.text}`);

describe("how your agent did it (F31)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetModelSettings();
  });
  afterEach(() => resetModelSettings());

  it("is on by default", () => expect(flag("AGENT_STORY")).toBe(true));

  it("Maya's agent: turned down three, liked the market, signed it; code locked it", async () => {
    const pid = await locked();
    expect(texts(pid, "maya")).toEqual([
      "1|Read 5 plans. Turned down 3 that break your rules. Liked Dolores Night Market most (5/5).",
      "2|Signed Dolores Night Market.",
      "3|Kept its signature on Dolores Night Market while the others caught up.",
      "L|Code locked Dolores Night Market with all five signatures.",
    ]);
  });

  it("Kai's agent held out, then agreed", async () => {
    const pid = await locked();
    const k = texts(pid, "kai");
    expect(k[0]).toMatch(/^1\|Read 5 plans\. None broke your rules\. Liked .+ most \(\d\/5\)\.$/);
    expect(k[1]).toMatch(/^2\|Held out for .+ \(your \d\/5\)\.$/);
    expect(k[2]).toBe("3|Agreed to Dolores Night Market: not your first pick, but it fits your rules.");
  });

  it("is only ever about your own agent: nobody else's words or decisions", async () => {
    const pid = await locked();
    for (const id of FIVE) {
      const story = JSON.stringify(agentStory(pid, id));
      for (const other of FIVE.filter((x) => x !== id)) for (const w of privatePhrases(pid, other)) expect(story).not.toContain(w);
      expect(story).not.toMatch(/Maya|Dev|Ana|Kai|Zoe/);
    }
    expect(agentStory(pid, "priya")).toBeNull();
  });

  it("says when code stepped in (rogue model) and when nothing fit", async () => {
    setModelSettings({ rogue: true });
    const pid = await locked();
    expect(texts(pid, "maya")[1]).toBe("1|Code overrode your agent 3 times: it said yes to plans that break your rules.");
    resetModelSettings();
    const failed = await locked(D.clashSentences);
    expect(texts(failed, "maya").at(-1)).toBe("L|No plan fit all five. Nobody was told why.");
  });
});
