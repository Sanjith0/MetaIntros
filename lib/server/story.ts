import { flag } from "@/lib/flags";
import { LABEL } from "./memory";
import { store } from "./store";

/**
 * "How your agent did it" (F31): your own agent's moves, round by round, in
 * plain words, for your phone only. Built from your own verdicts and what
 * everyone already sees (the lock). Never another member's decisions.
 */
export interface StoryStep {
  round: number | null;
  text: string;
  /** "code": code stepped in (an override, or the lock). */
  tone: "agent" | "code";
}

export function agentStory(partyId: string, ownerId: string): StoryStep[] | null {
  const s = store();
  const party = s.parties.get(partyId);
  if (!party || !party.memberIds.includes(ownerId)) return null;
  const mine = s.verdicts.filter((v) => v.partyId === partyId && v.ownerId === ownerId);
  if (!mine.length) return null;
  const title = (id: string) => s.plans.get(id)?.title ?? "a plan";
  const steps: StoryStep[] = [];

  const r1 = mine.filter((v) => v.round === 1);
  if (r1.length) {
    const turned = r1.filter((v) => v.decision === "reject").length;
    const liked = r1.filter((v) => v.decision !== "reject").sort((a, b) => b.preference - a.preference)[0];
    const parts = [`Read ${r1.length} ${r1.length === 1 ? "plan" : "plans"}.`];
    parts.push(turned ? `Turned down ${turned} that ${turned === 1 ? "breaks" : "break"} your rules.` : "None broke your rules.");
    if (liked) parts.push(`Liked ${title(liked.planId)} most (${liked.preference}/5).`);
    steps.push({ round: 1, text: parts.join(" "), tone: "agent" });
    // F56: when it used what it remembers (F39), say so.
    const remembered = flag("STORY_MEMORY") ? (s.briefs.get(`brief-${ownerId}`)?.preferences ?? []).filter((p) => p.sourceText.startsWith("remembered from")) : [];
    if (remembered.length) {
      steps.push({ round: 1, text: `It used what it remembers about you: ${remembered.map((p) => LABEL[p.tag] ?? p.tag).join(", ")} (${remembered[0]!.sourceText}).`, tone: "agent" });
    }
    const over = r1.filter((v) => v.overriddenByCode).length;
    if (over) steps.push({ round: 1, text: `Code overrode your agent ${over === 1 ? "once" : `${over} times`}: it said yes to ${over === 1 ? "a plan" : "plans"} that ${over === 1 ? "breaks" : "break"} your rules.`, tone: "code" });
  }
  const pref = (planId: string) => r1.find((v) => v.planId === planId)?.preference;
  for (const round of [2, 3]) {
    const v = mine.find((x) => x.round === round);
    if (!v) continue;
    const p = pref(v.planId);
    const before = mine.find((x) => x.round === round - 1 && round > 2);
    const text =
      v.decision === "sign"
        ? before?.decision === "sign" && before.planId === v.planId
          ? `Kept its signature on ${title(v.planId)} while the others caught up.`
          : `Signed ${title(v.planId)}.`
        : v.decision === "concede"
          ? `Agreed to ${title(v.planId)}: not your first pick, but it fits your rules.`
          : v.decision === "hold"
            ? `Held out for ${title(v.planId)}${p ? ` (your ${p}/5)` : ""}.`
            : `${v.decision === "reject" ? "Turned down" : "Was fine with"} ${title(v.planId)}.`;
    steps.push({ round, text, tone: "agent" });
    if (v.overriddenByCode) steps.push({ round, text: "Code overrode that: the plan breaks one of your rules.", tone: "code" });
  }
  if (party.status === "locked" && party.planId) {
    steps.push({ round: null, text: `Code locked ${title(party.planId)} ${party.lockedBy === "signatures" ? "with all five signatures" : "as the best plan that passes everyone's rules"}.`, tone: "code" });
  } else if (party.status === "failed") {
    steps.push({ round: null, text: "No plan fit all five. Nobody was told why.", tone: "code" });
  }
  return steps;
}
