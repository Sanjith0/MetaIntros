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

describe("the story says when your agent used what it remembers (F56)", () => {
  it("is on by default, and after a night remembered as too loud, the next story says it used 'prefers quiet'", async () => {
    const { flag: f } = await import("@/lib/flags");
    const { remember } = await import("@/lib/server/memory");
    expect(f("STORY_MEMORY")).toBe(true);
    process.env.PQ_PACE_MS = "0";
    const first = await locked();
    remember(first, "maya", "loud", ["quiet"]);
    const memory = store().memory.get("maya")!;
    resetStore();
    store().memory.set("maya", memory); // the next night (locked() would reset the store)
    for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
    const pid = [...store().parties.keys()][0]!;
    await runParty(pid, { paceMs: 0 });
    const story = agentStory(pid, "maya")!.map((x) => x.text);
    expect(story).toContain("It used what it remembers about you: prefers quiet (remembered from Dolores Night Market).");
    // Nobody else's story mentions it.
    for (const id of ["dev", "ana", "kai", "zoe"]) expect(JSON.stringify(agentStory(pid, id))).not.toContain("remembers");
  });
});

describe("the story after the lock (F61)", () => {
  it("is on by default; a switch to plan B is told, and the lock still names the plan five signed", async () => {
    const { flag: f } = await import("@/lib/flags");
    const { askToSwitch } = await import("@/lib/server/switchplan");
    expect(f("STORY_CHANGES")).toBe(true);
    process.env.PQ_PACE_MS = "0";
    const pid = await locked();
    for (const id of ["maya", "dev", "kai"]) askToSwitch(pid, id);
    const t = texts(pid, "ana");
    expect(t).toContain("L|Code locked Dolores Night Market with all five signatures.");
    expect(t.at(-1)).toBe("L|Your party switched to plan B: Open Studio: Clay and Tea (three of five asked). It fits your rules too.");
  });

  it("someone who took an open seat is told just that, not a negotiation they weren't in", async () => {
    const { cantMakeIt } = await import("@/lib/server/refill");
    process.env.PQ_PACE_MS = "0";
    const pid = await locked();
    await joinQueue({ userId: "sam", eventId: D.entryEventId, sentence: "anything chill works for me", consentBridges: true, startTalk: false });
    await cantMakeIt(pid, "maya");
    expect(texts(pid, "sam")).toEqual(["L|You took an open seat on Dolores Night Market, a plan that was already set. Code checked it fits your rules."]);
  });
});
