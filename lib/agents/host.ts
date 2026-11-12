/**
 * AI Host for squad chats. One model call on party formation (welcome + plan + icebreaker),
 * then silent unless @mentioned (capped) or the chat stalls (template nudge, no model call).
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import { label } from "./describe";

export interface HostContext {
  eventTitle: string;
  when: string;
  meetingSpot: string;
  memberNames: string[];
  /** shared interests with counts, most common first (non-sensitive only) */
  shared: { tag: string; count: number }[];
}

const Welcome = z.object({
  welcome: z.string().min(10).max(500),
  icebreaker: z.string().min(10).max(300),
  interestTag: z.string(),
});
export type HostWelcome = z.infer<typeof Welcome>;

export const MENTION_RE = /@(host|queue ?up|ai)\b/i;

/** Pick the interest the icebreaker should be about: liked by the most members (≥2). */
export function icebreakerInterest(ctx: HostContext) {
  return ctx.shared.find((s) => s.count >= 2) ?? ctx.shared[0] ?? null;
}

export function templateWelcome(ctx: HostContext): HostWelcome {
  const top = icebreakerInterest(ctx);
  const lbl = top ? label(top.tag).toLowerCase() : "this weekend";
  return {
    welcome: `Hi all, I'm the Queue Up host, an AI. The plan: ${ctx.eventTitle}, ${ctx.when}. Meet at ${ctx.meetingSpot} 10 minutes early and walk in together. I'll stay out of the way. Ask me anything with @host.`,
    icebreaker: top ? `${top.count} of you are into ${lbl}. What got you into ${lbl}, and what's the best one you've been to/tried lately?` : "What are you most looking forward to this weekend?",
    interestTag: top?.tag ?? "",
  };
}

/** Valid only if it's about an interest ≥2 members actually share, and actually mentions it. */
export function icebreakerIsGrounded(w: HostWelcome, ctx: HostContext) {
  const s = ctx.shared.find((x) => x.tag === w.interestTag);
  if (!s || s.count < 2) return false;
  const words = label(w.interestTag).toLowerCase().split(/[\s/&]+/).filter((x) => x.length > 2);
  const text = w.icebreaker.toLowerCase();
  return words.some((wd) => text.includes(wd.replace(/s$/, "")));
}

export async function generateWelcome(ctx: HostContext) {
  const ai = await runAi({
    task: "host_welcome",
    system:
      "You are the friendly AI host of a temporary Facebook squad chat: strangers matched to attend an event together. Write a short warm welcome that restates the plan (event, time, meeting spot) and ONE icebreaker question about an interest at least two of them share (use the provided list only). No emojis spam, max 1 emoji. Never mention politics, religion, health or sexuality. JSON only: {\"welcome\": \"...\", \"icebreaker\": \"...\", \"interestTag\": \"<tag from shared list>\"}.",
    user: JSON.stringify({ ...ctx, shared: ctx.shared.slice(0, 8).map((s) => ({ tag: s.tag, label: label(s.tag), count: s.count })) }),
    schema: Welcome,
    fallback: () => templateWelcome(ctx),
    maxTokens: 260,
    temperature: 0.6,
  });
  const grounded = icebreakerIsGrounded(ai.value, ctx);
  return { value: grounded ? ai.value : templateWelcome(ctx), source: grounded ? ai.source : "fallback", grounded };
}

const Reply = z.object({ reply: z.string().min(2).max(400) });

export async function generateReply(ctx: HostContext, recent: { from: string; text: string }[]) {
  const last = recent.at(-1)?.text ?? "";
  const fallback = () => {
    if (/where|meet|spot/i.test(last)) return { reply: `Meet at ${ctx.meetingSpot}. It's a public venue — look for each other 10 minutes before ${ctx.when.split("·").pop()?.trim() ?? "start"}.` };
    if (/when|time/i.test(last)) return { reply: `${ctx.eventTitle} is ${ctx.when}.` };
    return { reply: `I'm here! Plan is ${ctx.eventTitle}, ${ctx.when}, meeting at ${ctx.meetingSpot}. Check your talk cards for things you have in common 🙂` };
  };
  const ai = await runAi({
    task: "host_reply",
    system: "You are the concise AI host of a squad chat for an event. Answer the latest @mention in 1–2 sentences using only the plan details provided. Never share anyone's private info. JSON only: {\"reply\": \"...\"}.",
    user: JSON.stringify({ plan: { event: ctx.eventTitle, when: ctx.when, meetingSpot: ctx.meetingSpot }, recent: recent.slice(-6) }),
    schema: Reply,
    fallback,
    maxTokens: 120,
  });
  return { reply: ai.value.reply, source: ai.source };
}

export function stallNudge(ctx: HostContext, n: number) {
  const s = ctx.shared[n + 1] ?? ctx.shared[0];
  return s ? `Quiet in here 👀 Quick one: ${label(s.tag).toLowerCase()} — what's a hidden gem around here?` : "Quiet in here 👀 Who's most excited for this one?";
}
