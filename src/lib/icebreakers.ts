import { EVENTS, VENUES, profileById } from "@/data/seed";
import { pretty } from "@/lib/geo";
import { museEnabled, museJson, museText } from "@/lib/muse";
import { evidenceList, shared } from "@/lib/signals";
import { state } from "@/lib/store";
import type { ChatMessage, Crew, Hook, Icebreaker, Profile } from "@/lib/types";

function templateHook(ev: string, other: Profile): Hook {
  const [kind, value] = [ev.slice(0, ev.indexOf(":")), ev.slice(ev.indexOf(":") + 1)];
  switch (kind) {
    case "likes":
      return { evidence: ev, text: `You both like ${value}. Ask ${other.name} what got them into it.` };
    case "group":
      return { evidence: ev, text: `You're both in “${value}” on Facebook.` };
    case "event":
      return { evidence: ev, text: `You were both at ${value}. Swap stories!` };
    case "friend":
      return { evidence: ev, text: `${value} is a mutual friend.` };
    case "school":
      return { evidence: ev, text: `You both went to ${value}.` };
    default:
      return { evidence: ev, text: value };
  }
}

const rank = (e: string) => (e.startsWith("event:") ? 0 : e.startsWith("friend:") ? 1 : e.startsWith("school:") ? 2 : e.startsWith("likes:") ? 3 : 4);

function fallback(me: Profile, other: Profile): Icebreaker {
  const ev = evidenceList(me, other).sort((a, b) => rank(a) - rank(b));
  const hooks = ev.slice(0, 3).map((e) => templateHook(e, other));
  const firstLike = shared(me, other).likes[0];
  return {
    fromId: me.id,
    toId: other.id,
    hooks,
    opener: firstLike
      ? `“Okay, ${other.name}, important question: what's your favorite ${firstLike} thing right now?”`
      : `“Hey ${other.name}! How long have you been in Austin?”`,
    mutualFriends: shared(me, other).friends,
  };
}

interface AiIce {
  hooks?: Hook[];
  opener?: string;
}

export async function icebreaker(meId: string, otherId: string): Promise<Icebreaker & { ai: boolean }> {
  const key = `${meId}->${otherId}`;
  const cache = state().icebreakers as Map<string, Icebreaker & { ai: boolean }>;
  const hit = cache.get(key);
  if (hit) return hit;
  const me = profileById(meId)!;
  const other = profileById(otherId)!;
  const allowed = evidenceList(me, other);
  let out: Icebreaker & { ai: boolean } = { ...fallback(me, other), ai: false };
  if (museEnabled() && allowed.length) {
    const r = await museJson<AiIce>({
      model: "ember",
      timeoutMs: 12000,
      maxTokens: 500,
      system:
        "You write icebreakers for two strangers about to meet in person before a concert. Use ONLY the shared evidence provided; never invent facts. Be warm, specific, and a little playful. Reply with JSON only.",
      user: JSON.stringify({
        schema: { hooks: [{ text: "max 18 words, addressed to the reader", evidence: "exactly one string from allowedEvidence" }], opener: "one natural first line the reader could say out loud, max 20 words" },
        reader: { name: me.name, bio: me.bio },
        other: { name: other.name, pronouns: other.pronouns, bio: other.bio, work: other.work },
        allowedEvidence: allowed,
        rules: "2-3 hooks. Prefer events, mutual friends and specific likes over generic groups.",
      }),
    });
    // Code check: every hook must cite real shared evidence. Drop the rest.
    const hooks = (r?.hooks ?? []).filter((h) => h && typeof h.text === "string" && allowed.includes(h.evidence)).slice(0, 3);
    if (hooks.length >= 2 && r?.opener) {
      out = { fromId: meId, toId: otherId, hooks, opener: r.opener, mutualFriends: shared(me, other).friends, ai: true };
    }
  }
  cache.set(key, out);
  return out;
}

export async function kickoffMessage(crew: Crew): Promise<ChatMessage> {
  const v = VENUES.find((x) => x.id === crew.plan.venueId)!;
  const ev = EVENTS.find((e) => e.id === crew.eventId)!;
  const names = crew.memberIds.map((id) => profileById(id)!.name);
  let text = `Hey ${names.join(", ")} 👋 You're a crew for ${ev.title}! Plan: meet at ${v.name} at ${pretty(crew.plan.time)}, then walk over together (${crew.plan.walkToEventMin} min) for the ${pretty(ev.startTime)} start. Why you: ${crew.rationale} First question for the group: what song are you hoping they play?`;
  if (crew.aiMode === "muse") {
    const t = await museText({
      model: "ember",
      timeoutMs: 10000,
      maxTokens: 220,
      system: "You are the Crew assistant inside Facebook. You speak as yourself (never as a user). Write a short, warm group-chat kickoff, max 70 words, with the plan and one fun group question. No hashtags.",
      user: JSON.stringify({ names, event: ev.title, start: pretty(ev.startTime), meetup: v.name, time: pretty(crew.plan.time), walkMin: crew.plan.walkToEventMin, why: crew.rationale }),
    });
    if (t && t.length < 600) text = t;
  }
  return { id: `m-${Date.now()}`, authorId: "assistant", text, at: Date.now() };
}

// Scripted replies from seeded crewmates so the chat feels alive in a single-device demo.
// These are labeled "simulated" in the UI.
export function seededReplies(crew: Crew): ChatMessage[] {
  const others = crew.memberIds.filter((id) => id !== crew.seekerId);
  const lines: Record<string, string> = {
    priya: "omg hi!! I've been wanting to see them for ages. “Saltwater” or riot",
    grace: "Hiii! I'll be the one with a crochet frog keychain 🐸",
    hannah: "Matcha before a show is elite planning. See you all there!",
    aisha: "Coming from the climbing gym so I may be slightly chalky",
    noor: "hi friends :) I'm bringing zines for anyone who wants one",
    marcus: "Hey all, first show since moving here, kinda nervous lol",
    tyler: "gg we queued into a good lobby",
    sofia: "I'll bring my film camera if anyone wants crew pics!",
    diego: "If anyone's hungry after, I know a taco truck",
  };
  return others
    .filter((id) => lines[id])
    .slice(0, 3)
    .map((id, i) => ({ id: `s-${id}`, authorId: id, text: lines[id], at: Date.now() + (i + 1) * 1000, simulated: true }));
}

export async function simulatedReply(crew: Crew, userText: string): Promise<ChatMessage | null> {
  const others = crew.memberIds.filter((id) => id !== crew.seekerId);
  const who = profileById(others[(crew.chat.length + 1) % others.length])!;
  let text = `Haha love that. See you at ${VENUES.find((v) => v.id === crew.plan.venueId)!.name}!`;
  const t = await museText({
    model: "ember",
    timeoutMs: 8000,
    maxTokens: 80,
    system: `Role-play ${who.name} (${who.age}, ${who.bio}; likes ${who.likes.join(", ")}) replying in a new friend group chat before a concert. One casual message, max 25 words, lowercase ok. This is a labeled demo simulation.`,
    user: userText.slice(0, 500),
  });
  if (t) text = t.replace(/^"|"$/g, "");
  return { id: `r-${Date.now()}`, authorId: who.id, text, at: Date.now(), simulated: true };
}
