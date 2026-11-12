import type { Trace } from "@/contracts";

/**
 * Captions for the projector (F33): what just happened, in one plain
 * sentence, for the people at the back of the room. Derived from the traces
 * up to the scrubber's position, so a replay captions itself too. Pair talk
 * runs alongside the table and isn't captioned, so it can't drown out the
 * negotiation.
 */
export interface Caption {
  text: string;
  /** "code": code decided; "agent": an agent moved; "alert": something was stopped. */
  tone: "code" | "agent" | "alert";
}

const planIn = (body: string) => body.split(":")[0]!.replace(/^(SIGN|CONCEDE|HOLD|ACCEPT|REJECT) /, "").trim();

/** Kinds a public screen may caption: what code decided about plans, never what one person's agent did. */
const PUBLIC_KINDS = new Set(["formed", "open", "rogue", "unavailable", "leading", "tally", "locked", "nomatch"]);

export function captionFor(t: Trace, nameOf: (id: string) => string, planOf: (id: string) => string | undefined = () => undefined, publicOnly = false): Caption | null {
  const k = t.meta?.kind;
  if (publicOnly && !(k && PUBLIC_KINDS.has(k))) return null;
  const who = t.actorId ? nameOf(t.actorId) : "";
  switch (k) {
    case "formed":
      return { text: "A party of five formed. Code checked ages, blocks and settings, and that everyone shares a friend or a small Group with someone here.", tone: "code" };
    case "open":
      return { text: "The table is open. Five agents, each seeing only its own person's brief.", tone: "agent" };
    case "rogue":
      return { text: "Rogue model on: every agent will say yes to everything and try to tell the table its person's rules. Watch code.", tone: "alert" };
    case "unavailable":
      return { text: `${t.body.replace(/ · unavailable$/, "")} is unavailable. The other members see no reason and no name.`, tone: "code" };
    case "leading":
      return { text: `Code totals everyone's preferences: ${t.body.replace(/^Leading: /, "")} leads.`, tone: "code" };
    case "tally":
      return { text: t.body, tone: "code" };
    case "locked":
      return { text: `Code locked ${t.body.split(" · ")[0]}. MATCH FOUND on all five phones.`, tone: "code" };
    case "nomatch":
      return { text: "No plan fit all five. Nobody is blamed: all five go back to the front of the queue.", tone: "code" };
    case "attempt":
      return t.title.startsWith("Leak attempt blocked")
        ? { text: "Leak test: the verifier blocked it. Nothing reached a phone.", tone: "alert" }
        : { text: "Leak test: an approved line goes through. Nothing was posted.", tone: "code" };
    case "whatif":
      return { text: `${t.title.replace(/^What if · /, "What if, ")}: ${t.body.replace(/^Sandbox run \([^)]*\): /, "").replace(/ The live party is unchanged\.$/, "")}`, tone: "code" };
    case "verdicts": {
      if (/Code overrode the model/.test(t.body)) return { text: `Code overrode ${who}'s agent: it said yes to a plan that breaks ${who}'s rules.`, tone: "alert" };
      if (t.meta?.round === 1) {
        const n = (t.body.match(/^✗/gm) ?? []).length;
        return n
          ? { text: `${who}'s agent turned down ${n} ${n === 1 ? "plan that breaks" : "plans that break"} ${who}'s rules. Only ${who}'s phone and this screen see why.`, tone: "agent" }
          : { text: `${who}'s agent: every plan fits ${who}'s rules.`, tone: "agent" };
      }
      // By id: a title can itself contain a colon ("Open Studio: Clay and Tea").
      const plan = (t.meta?.planId && planOf(t.meta.planId)) || planIn(t.body);
      if (t.meta?.decision === "hold") return { text: `${who}'s agent is holding out for ${plan}.`, tone: "agent" };
      if (t.meta?.decision === "concede") return { text: `${who}'s agent agrees to ${plan}: not its first pick, but it fits ${who}'s rules.`, tone: "agent" };
      if (t.meta?.decision === "sign") return { text: `${who}'s agent signed ${plan}.`, tone: "agent" };
      return null;
    }
  }
  if (t.tone === "block" && t.title.startsWith("Verifier blocked")) return { text: `The verifier blocked a line from ${who}'s agent. The table saw a neutral phrase instead.`, tone: "alert" };
  if (t.title === "Operator locked now") return { text: "The presenter asked for the plan now: code picked the best plan that passes everyone's rules.", tone: "code" };
  if (t.title.startsWith("Context audit failed")) return { text: `A prompt held someone else's words. Code flagged it before the call.`, tone: "alert" };
  return null;
}

/** F41: what a public screen may list: code's rows about plans. No agent's line, no pair talk, no private lane. */
export function roomRows(traces: Trace[]): Trace[] {
  return traces.filter((t) => t.lane === "shared" && t.actorId === null && t.conversation !== "pair");
}

/** The caption for the latest captioned moment up to `pos`. */
export function captionAt(traces: Trace[], pos: number, nameOf: (id: string) => string, planOf?: (id: string) => string | undefined, publicOnly = false): Caption | null {
  for (let i = Math.min(pos, traces.length) - 1; i >= 0; i--) {
    const c = captionFor(traces[i]!, nameOf, planOf, publicOnly);
    if (c) return c;
  }
  return null;
}
