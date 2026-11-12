import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { privatePhrases } from "@/lib/agents/audit";
import { runParty } from "@/lib/agents/orchestrator";
import { flag } from "@/lib/flags";
import { submitPicks } from "@/lib/server/after";
import { forgetNight } from "@/lib/server/forget";
import { remember } from "@/lib/server/memory";
import { myData } from "@/lib/server/mydata";
import { joinQueue } from "@/lib/server/queue";
import { resetStore, store } from "@/lib/server/store";

const FIVE = ["dev", "ana", "kai", "zoe", "maya"];
async function locked() {
  resetStore();
  for (const id of FIVE) await joinQueue({ userId: id, eventId: D.entryEventId, sentence: D.sentences[id]!, consentBridges: true, startTalk: false });
  const pid = [...store().parties.keys()][0]!;
  await runParty(pid, { paceMs: 0 });
  return pid;
}
const section = (d: ReturnType<typeof myData>, id: string) => d.sections.find((s) => s.id === id)!.items;

describe("your data (F40)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });

  it("is on by default", () => expect(flag("MY_DATA")).toBe(true));

  it("lists what's yours: sentence and rules, the party and your agent's work, memory and picks", async () => {
    const pid = await locked();
    submitPicks(pid, "maya", ["dev"]);
    remember(pid, "maya", "loud", ["quiet"]);
    const d = myData("maya");
    expect(d.sections.map((s) => s.id)).toEqual(["profile", "brief", "queue", "parties", "memory", "picks", "safety", "consents", "messages"]);
    expect(section(d, "brief")).toEqual(expect.arrayContaining([`Sentence: “${D.sentences.maya}”`, "Rule: Done by 11 PM (“out by eleven”)", "Rule: $20 or less (“under twenty bucks”)"]));
    expect(section(d, "parties")).toEqual([expect.stringMatching(/^Dolores Night Market \(locked\): 7 private agent decisions, 3 prompts, a receipt$/)]);
    expect(section(d, "memory")).toEqual(["prefers quiet (from Dolores Night Market)"]);
    expect(section(d, "picks")).toEqual(["Dolores Night Market: picked Dev"]);
  });

  it("holds nobody else's private data", async () => {
    const pid = await locked();
    const all = JSON.stringify(myData("maya"));
    for (const id of FIVE.filter((x) => x !== "maya")) for (const w of privatePhrases(pid, id)) expect(all).not.toContain(w);
  });

  it("after Forget my night, it says so", async () => {
    const pid = await locked();
    forgetNight(pid, "maya");
    const d = myData("maya");
    expect(section(d, "parties")).toEqual(["Dolores Night Market (locked): your private data was forgotten"]);
    expect(section(d, "brief")).toContain("Sentence: forgotten");
  });
});
