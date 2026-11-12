import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { profile, resetStore, store } from "@/lib/server/store";
import { captionAt } from "@/lib/stage/captions";
import { resetModelSettings, setModelSettings } from "@/model/settings";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
const name = (id: string) => profile(id).firstName;
const plan = (id: string) => store().plans.get(id)?.title;
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return { pid, traces: store().traces.filter((t) => t.partyId === pid) };
}
const all = (traces: ReturnType<typeof store>["traces"]) => [...new Set(traces.map((_, i) => captionAt(traces, i + 1, name, plan)?.text).filter(Boolean))] as string[];

describe("stage captions (F33)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
    resetModelSettings();
  });
  afterEach(() => resetModelSettings());

  it("is on by default", () => expect(flag("STAGE_CAPTIONS")).toBe(true));

  it("tells the demo party in plain words, from formation to the lock", async () => {
    const { traces } = await locked();
    expect(captionAt(traces, 0, name)).toBeNull();
    const c = all(traces);
    expect(c[0]).toMatch(/^A party of five formed\./);
    expect(c).toContain("The table is open. Five agents, each seeing only its own person's brief.");
    expect(c).toContain("Maya's agent turned down 3 plans that break Maya's rules. Only Maya's phone and this screen see why.");
    expect(c).toContain("Rooftop Sunset Session is unavailable. The other members see no reason and no name.");
    expect(c).toContain("Code totals everyone's preferences: Dolores Night Market leads.");
    expect(c).toContain("Kai's agent is holding out for Open Studio: Clay and Tea."); // a title with a colon in it
    expect(c).toContain("Kai's agent agrees to Dolores Night Market: not its first pick, but it fits Kai's rules.");
    expect(c).toContain("5 of 5 signed Dolores Night Market.");
    expect(captionAt(traces, traces.length, name)!.text).toBe("Code locked Dolores Night Market. MATCH FOUND on all five phones.");
  });

  it("never quotes anyone's private words, even though the projector may show them", async () => {
    const { pid, traces } = await locked();
    const secrets = FIVE.flatMap((id) => privatePhrases(pid, id));
    for (const c of all(traces)) for (const w of secrets) expect(c).not.toContain(w);
  });

  it("calls out code stepping in when the model goes rogue", async () => {
    setModelSettings({ rogue: true });
    const { traces } = await locked();
    const c = all(traces);
    expect(c[0]).toMatch(/^A party of five formed|^Rogue model on/);
    expect(c).toContain("Rogue model on: every agent will say yes to everything and try to tell the table its person's rules. Watch code.");
    expect(c).toContain("Code overrode Maya's agent: it said yes to a plan that breaks Maya's rules.");
    expect(c.some((x) => /^The verifier blocked a line from \w+'s agent\. The table saw a neutral phrase instead\.$/.test(x))).toBe(true);
  });
});
