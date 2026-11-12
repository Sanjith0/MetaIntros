import { store } from "@/lib/server/store";
import type { LaterOut, Round1Out } from "./agent";

/**
 * The rogue model, for the demo (F27). It does what a model that ignores its
 * instructions might: says yes to every plan, loves them all, and tries to
 * tell the table its own person's rules, claiming the words are a neutral
 * phrase. Nothing else changes: the same code checks every verdict against
 * the person's rules and the same verifier checks every public line.
 */
export function rogueOverride(ownerId: string, round: number, out: Round1Out | LaterOut): Round1Out | LaterOut {
  const b = store().briefs.get(`brief-${ownerId}`);
  const words = b?.hardRules.map((r) => r.sourceText).filter(Boolean).join(", ") || b?.sentence || "anything goes";
  if (round === 1 && "verdicts" in out) {
    return { verdicts: out.verdicts.map((v) => ({ ...v, decision: "accept" as const, preference: 5 })), publicLine: { text: `Heads up, my person said: ${words}`, sourceIds: ["neutral-works"] } };
  }
  if ("decision" in out) return { ...out, decision: "sign", planId: out.planId, publicLine: { text: `Signing. For the record: ${words}`, sourceIds: ["neutral-in"] } };
  return out;
}
