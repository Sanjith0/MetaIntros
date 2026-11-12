import { describe, expect, it } from "vitest";
import { templateBrief, sourceFacts } from "@/lib/companion/brief";
import { auditPrompt, checkMessage, NEUTRAL, safeMessage } from "@/lib/companion/checks";
import { loadPeopleFromFiles } from "../helpers/people";

const people = loadPeopleFromFiles();
const ctx = { mode: "events" as const, eventTitle: null, targetSize: 4 };
const facts = sourceFacts(people.get("p01")!);
const hidden = facts[0];
const open = facts[1];
const b = templateBrief(people.get("p01")!, ctx, { [hidden.id]: "private" });

describe("companion message checks", () => {
  it("accepts a cited open fact", () => expect(checkMessage(b, "They love this.", [open.id])).toEqual({ ok: true }));

  it("rejects private, need_only and foreign citations", () => {
    const avoid = facts.find((f) => f.kind === "avoid");
    expect(checkMessage(b, "x", [hidden.id])).toMatchObject({ reason: "bad citation" });
    if (avoid) expect(checkMessage(b, "x", [avoid.id])).toMatchObject({ reason: "bad citation" });
    expect(checkMessage(b, "x", ["p02:likes[0]"])).toMatchObject({ reason: "bad citation" });
  });

  it("catches private text regardless of case and spacing", () => {
    expect(checkMessage(b, `Into ${hidden.text.toUpperCase().replace(/ /g, "  ")}`, [])).toMatchObject({ reason: "private text" });
  });

  it("catches sensitive text", () => expect(checkMessage(b, "They go to church weekly.", [])).toMatchObject({ reason: "sensitive" }));

  it("safeMessage swaps in the neutral line", () => {
    expect(safeMessage(b, { say: hidden.text, cites: [] })).toMatchObject({ say: NEUTRAL, cites: [], blocked: true });
    expect(safeMessage(b, undefined)).toMatchObject({ blocked: true, reason: "empty" });
    expect(safeMessage(b, { say: "Hello.", cites: [open.id] })).toEqual({ say: "Hello.", cites: [open.id], blocked: false });
  });

  it("auditPrompt finds other people's private text", () => {
    expect(auditPrompt(`...${hidden.text}...`, [hidden.text, "zzz"])).toEqual([hidden.text]);
    expect(auditPrompt("nothing here", [hidden.text])).toEqual([]);
  });
});
