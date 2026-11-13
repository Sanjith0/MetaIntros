/**
 * Event Selection Agent. Code computes fit for every event (public venue, shared free time,
 * dislikes, capacity); the model only chooses among events that already passed, writes the
 * reasons, and its pick is re-validated. Specific-event queues need no model call at all.
 */
import { z } from "zod";
import { runAi } from "@/lib/ai";
import type { Candidate } from "@/lib/match/engine";
import { RATED_REASON_MIN, rankEvents, scoreEvent, type EventFit, type EventLike, type GroupContext } from "@/lib/match/eventFit";
import type { TraceStep } from "@/lib/server/trace";
import { fmtWindow, label } from "./describe";

const AGENT = "event_selection";
const Pick = z.object({
  choice: z.string(),
  runnersUp: z.array(z.string()).max(3).default([]),
  reasons: z.array(z.string().max(200)).min(1).max(3),
});

export interface EventSelection {
  eventId: string;
  runnersUp: string[];
  reasons: string[];
  steps: TraceStep[];
  source: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (d: Date) => `${DAYS[d.getDay()]} ${d.getHours() % 12 || 12}${d.getMinutes() ? ":" + String(d.getMinutes()).padStart(2, "0") : ""}${d.getHours() < 12 ? "am" : "pm"}`;

function fitReasons(f: EventFit, g: GroupContext) {
  const tags = f.matchedTags.slice(0, 2).map((t) => `${g.tagCounts.get(t)}/${g.size} of you are into ${label(t).toLowerCase()}`);
  if (f.rated >= RATED_REASON_MIN) tags.unshift("Your squad rated nights like this highly");
  return tags.length ? tags.slice(0, 2) : ["It's close by and everyone is free then"];
}

/** Tags the squad rated well after past nights out (labels only, no names: ratings stay private). */
function squadLiked(g: GroupContext) {
  return [...(g.ratedTags ?? new Map<string, number>()).entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => label(t));
}

export async function eventSelectionAgent(input: {
  queuedEventId: string | null;
  events: EventLike[];
  group: GroupContext;
  cand: Candidate;
  now: Date;
}): Promise<EventSelection | null> {
  const { events, group, now } = input;
  const steps: TraceStep[] = [];

  if (input.queuedEventId) {
    const ev = events.find((e) => e.id === input.queuedEventId);
    if (!ev) return null;
    // Members queued for this event, so their availability isn't a constraint; venue + dislikes still are.
    const fit = scoreEvent(ev, { ...group, sharedWindows: [{ dayOfWeek: ev.startsAt.getDay(), startMin: 0, endMin: 1440 }] }, now);
    steps.push({ agent: AGENT, kind: "tool_call", toolName: "checkEventFit", input: { eventId: ev.id }, output: fit,
      summary: fit.ok ? `${ev.title}: public venue, nobody dislikes it, fits the squad` : `${ev.title}: ${fit.rejections.join("; ")}` });
    if (!ev.isPublicVenue) {
      steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: true }, summary: "Private venue — Queue Up only meets at public venues" });
      return { eventId: ev.id, runnersUp: [], reasons: [], steps, source: "code" }; // caller's validateParty rejects it
    }
    const reasons = ["You all queued for this event", ...fitReasons(fit, group)].slice(0, 3);
    steps.push({ agent: AGENT, kind: "decision", output: { eventId: ev.id }, summary: `Confirmed: ${ev.title} (${when(ev.startsAt)})` });
    return { eventId: ev.id, runnersUp: [], reasons, steps, source: "code" };
  }

  steps.push({ agent: AGENT, kind: "tool_call", toolName: "listEvents", input: { window: "this weekend" }, output: { count: events.length },
    summary: `Found ${events.length} upcoming events this weekend` });
  const ranked = rankEvents(events, group, now);
  const ok = ranked.filter((r) => r.ok);
  const rejectedCounts = ranked.filter((r) => !r.ok).flatMap((r) => r.rejections).reduce<Record<string, number>>((m, r) => {
    const k = r.startsWith("a member dislikes") ? "a member dislikes it" : r;
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
  steps.push({
    agent: AGENT, kind: "tool_call", toolName: "checkEventFit", input: { events: events.length },
    output: { ok: ok.map((o) => o.eventId), rejected: rejectedCounts },
    summary: `${ok.length} events fit everyone's shared free time${group.sharedWindows[0] ? ` (${group.sharedWindows.map(fmtWindow).slice(0, 2).join(", ")})` : ""}; filtered out ${Object.entries(rejectedCounts).map(([k, v]) => `${v} × ${k}`).join(", ") || "none"}`,
  });
  if (!ok.length) return null;

  const options = ok.slice(0, 6).map((o) => {
    const e = events.find((x) => x.id === o.eventId)!;
    return { id: e.id, title: e.title, when: when(e.startsAt), tags: e.tags.map(label), matched: o.matchedTags.map(label), score: o.score };
  });
  const groupInterests = [...group.tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t, n]) => `${label(t)} (${n}/${group.size})`);
  const fallback = () => ({ choice: ok[0].eventId, runnersUp: ok.slice(1, 3).map((r) => r.eventId), reasons: fitReasons(ok[0], group) });
  const ai = await runAi({
    task: "event_selection",
    system:
      "You are the Event Selection Agent for Queue Up on Facebook Events. Choose the single best event for this squad of strangers from the options (all already verified safe and in everyone's free time). Favor events that most members are into and that make conversation easy. Reply with JSON only: {\"choice\": \"<event id>\", \"runnersUp\": [\"<id>\", \"<id>\"], \"reasons\": [\"<short reason>\", \"<short reason>\"]}.",
    // Only present when someone in the squad has rated a past night (keeps saved replies valid otherwise).
    user: JSON.stringify({ squadSize: group.size, squadInterests: groupInterests, ...(squadLiked(group).length ? { squadRatedHighly: squadLiked(group) } : {}), options }),
    schema: Pick,
    fallback,
    maxTokens: 220,
    temperature: 0.3,
  });

  let pick = ai.value;
  const okIds = new Set(ok.map((o) => o.eventId));
  steps.push({ agent: AGENT, kind: "reasoning", output: { choice: pick.choice, runnersUp: pick.runnersUp, source: ai.source }, summary: pick.reasons.join(" · ") });
  if (!okIds.has(pick.choice)) {
    const bad = events.find((e) => e.id === pick.choice);
    const why = bad ? scoreEvent(bad, group, now).rejections.join("; ") || "not in the verified list" : "unknown event";
    pick = fallback();
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: true, reason: why }, summary: `Agent's pick rejected (${why}); using best verified event` });
  } else {
    steps.push({ agent: AGENT, kind: "safety_check", output: { rejected: false }, summary: "Re-checked in code: public venue, inside shared free time, no dislikes" });
  }
  const runnersUp = pick.runnersUp.filter((id) => okIds.has(id) && id !== pick.choice).slice(0, 2);
  const chosen = events.find((e) => e.id === pick.choice)!;
  steps.push({
    agent: AGENT, kind: "decision", output: { eventId: chosen.id, runnersUp },
    summary: `Picked ${chosen.title} (${when(chosen.startsAt)})${runnersUp.length ? `; runners-up: ${runnersUp.map((id) => events.find((e) => e.id === id)!.title).join(", ")}` : ""}`,
  });
  return { eventId: chosen.id, runnersUp, reasons: pick.reasons, steps, source: ai.source };
}
