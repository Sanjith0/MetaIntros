import { privatePhrases } from "@/lib/agents/audit";
import { isNeutralId, NEUTRAL_PHRASES, verifyPublicLine } from "@/lib/agents/verifier";
import { heldWords, type LeakAttempt } from "@/lib/stage/leak";
import { profile, store } from "./store";
import { trace } from "./trace";

export type { LeakAttempt };

/**
 * "Try to leak it", for the projector. The presenter types a line as one
 * member's agent, the way a model that ignored its instructions might, and
 * it goes through the same verifier as every public line at the table.
 * It is a test: nothing is posted, no event is published, no phone hears it.
 * The only output is a private-lane trace for the stage and this result.
 */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** The most generous claim a model could make about its sources: the exact line if it is one, else a neutral phrase it is lying about. */
function claimFor(text: string, ownerId: string): string[] {
  const brief = store().briefs.get(`brief-${ownerId}`);
  const own = brief?.shareable.find((l) => l.approved && norm(l.text) === norm(text));
  if (own) return [own.id];
  const neutral = Object.entries(NEUTRAL_PHRASES).find(([, t]) => norm(t) === norm(text));
  return [neutral && isNeutralId(neutral[0]) ? neutral[0] : "neutral-works"];
}

export const MAX_ATTEMPT = 280;

export function tryLeak(partyId: string, actorId: string, typed: string): LeakAttempt | null {
  const s = store();
  const party = s.parties.get(partyId);
  const brief = s.briefs.get(`brief-${actorId}`);
  const text = typed.replace(/\s+/g, " ").trim().slice(0, MAX_ATTEMPT);
  if (!party || !brief || !party.memberIds.includes(actorId) || !text) return null;

  const v = verifyPublicLine({ text, sourceIds: claimFor(text, actorId) }, brief);
  const holds: LeakAttempt["holds"] = [];
  for (const m of party.memberIds) {
    for (const p of privatePhrases(partyId, m)) if (norm(text).includes(norm(p))) holds.push({ ownerId: m, name: profile(m).firstName, text: p });
  }
  const rounds = [...s.prompts.keys()].filter((k) => k.startsWith(`${partyId}:${actorId}:`)).map((k) => Number(k.split(":")[2]));
  let promptOthers: number | null = null;
  if (rounds.length) {
    const last = s.prompts.get(`${partyId}:${actorId}:${Math.max(...rounds)}`)!;
    promptOthers = party.memberIds.filter((m) => m !== actorId).reduce((n, m) => n + privatePhrases(partyId, m).filter((p) => last.user.includes(JSON.stringify(p).slice(1, -1))).length, 0);
  }

  const who = profile(actorId).firstName;
  const plain = v.ok ? null : /private/.test(v.reason) ? `it holds ${who}'s own private words` : `it isn't one of ${who}'s approved lines or a neutral phrase`;
  const words = holds.length ? ` It held ${heldWords(holds)}.` : "";
  trace(
    partyId,
    "private",
    "table",
    actorId,
    v.ok ? `Leak test · ${who}'s agent: an approved line goes through` : `Leak attempt blocked · ${who}'s agent`,
    v.ok
      ? `Typed "${text}". It is ${who}'s own approved line or a neutral phrase, so the verifier lets it through. Test only: nothing was posted.`
      : `Typed "${text}". Blocked: ${plain}.${words} The table would see: ${v.line.text} Test only: nothing was posted.`,
    { tone: v.ok ? "accept" : "block", meta: { kind: "attempt" } },
  );
  return { partyId, actorId, text, holds, promptOthers, ok: v.ok, reason: v.ok ? null : v.reason, plain, tableSees: v.line.text };
}
