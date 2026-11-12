import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEMO_PARTY as D } from "@/fixtures";
import { parseSentence } from "@/lib/agents/brief";
import { runParty } from "@/lib/agents/orchestrator";
import { flag, setFlagOverride } from "@/lib/flags";
import { joinQueue } from "@/lib/server/queue";
import { secretView } from "@/lib/server/secret";
import { resetStore, store } from "@/lib/server/store";

const MAYA_ES = "algo tranquilo, salgo a las once, menos de veinte dólares, sin consumo mínimo";

describe("one sentence, in Spanish (F50)", () => {
  beforeEach(() => {
    process.env.PQ_PACE_MS = "0";
  });
  afterEach(() => setFlagOverride("SPANISH_SENTENCE", null));

  it("is on by default", () => expect(flag("SPANISH_SENTENCE")).toBe(true));

  it("reads the same rules and preferences, keeping the person's own words", () => {
    const p = parseSentence("maya", MAYA_ES);
    expect(p.hardRules.map((r) => [r.kind, r.value, r.sourceText])).toEqual([
      ["end_by", "23:00", "salgo a las once"],
      ["max_price", 20, "menos de veinte dólares"],
      ["no_drink_minimum", true, "sin consumo mínimo"],
    ]);
    expect(p.preferences.map((x) => [x.tag, x.weight])).toEqual([["chill", 2]]);
    expect(parseSentence("x", "en casa antes de la medianoche, hasta 40 dólares, al aire libre si es posible").hardRules.map((r) => r.value)).toEqual(["00:00", 40]);
    expect(parseSentence("x", "conocer gente, termino a las 10:30").hardRules[0]!.value).toBe("22:30");
  });

  it("English is read exactly as before", () => {
    for (const id of Object.keys(D.sentences)) {
      setFlagOverride("SPANISH_SENTENCE", false);
      const before = parseSentence(id, D.sentences[id]!);
      setFlagOverride("SPANISH_SENTENCE", null);
      expect(parseSentence(id, D.sentences[id]!)).toEqual(before);
    }
  });

  it("the demo party with Maya in Spanish ends the same: the market, her three turned down, and her words private", async () => {
    resetStore();
    for (const id of ["dev", "ana", "kai", "zoe", "maya"]) {
      await joinQueue({ userId: id, eventId: D.entryEventId, sentence: id === "maya" ? MAYA_ES : D.sentences[id]!, consentBridges: true, startTalk: false });
    }
    const pid = [...store().parties.keys()][0]!;
    await runParty(pid, { paceMs: 0 });
    const s = store();
    expect(s.plans.get(s.parties.get(pid)!.planId!)!.title).toBe("Dolores Night Market");
    expect(s.verdicts.filter((v) => v.ownerId === "maya" && v.round === 1 && v.decision === "reject").length).toBe(3);
    const secret = secretView(pid, "maya")!;
    expect(secret.rules.map((r) => r.yourWords)).toEqual(["salgo a las once", "menos de veinte dólares", "sin consumo mínimo"]);
    expect(secret.partyKnows).toEqual([]);
  });

  it("switched off, a Spanish sentence finds no rules", () => {
    setFlagOverride("SPANISH_SENTENCE", false);
    expect(parseSentence("maya", MAYA_ES).hardRules).toEqual([]);
  });
});
