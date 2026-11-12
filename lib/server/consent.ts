import { flag } from "@/lib/flags";
import { nowIso, store } from "./store";

/**
 * Consent history (F60). Every time you agree to something, or take it
 * back, one line is kept for you: showing how you're tied, which lines your
 * agent may share, what it may remember, keeping or forgetting a night, a
 * fact you stopped sharing. Only you see it, on /me.
 */
export interface ConsentEntry {
  at: string;
  text: string;
  kind: "gave" | "withdrew";
}

export function logConsent(userId: string, text: string, kind: ConsentEntry["kind"] = "gave") {
  if (!flag("CONSENT_HISTORY")) return;
  const s = store();
  if (!s.consentLog.has(userId)) s.consentLog.set(userId, []);
  s.consentLog.get(userId)!.push({ at: nowIso(), text, kind });
}

export const consentHistory = (userId: string): ConsentEntry[] => [...(store().consentLog.get(userId) ?? [])].reverse();
