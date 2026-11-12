// The crew-formation agent. Code gathers + filters candidates and validates every
// decision; Muse Spark makes the judgment calls (who works as a group, where to meet).
import { EVENTS, LANDMARKS, VENUES, profileById } from "@/data/seed";
import { fromMin, pretty, toMin, walkMinutes } from "@/lib/geo";
import { museEnabled, museJson } from "@/lib/muse";
import { hookSummary, pairScore, shared, tasteScore } from "@/lib/signals";
import { crewFor, saveCrew, state, visibleQueue } from "@/lib/store";
import type { Crew, FormStep, MeetupPlan, Profile, QueueFilters, Swap } from "@/lib/types";

const STEP_DELAY = Number(process.env.DEMO_STEP_DELAY_MS ?? 700);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const first = (id: string) => profileById(id)!.name;

function passesFilters(seeker: Profile, cand: Profile, f: QueueFilters, candF: QueueFilters) {
  if (cand.age < 18) return false;
  if (f.womenOnly && cand.gender === "man") return false;
  if (candF.womenOnly && seeker.gender === "man") return false;
  if (f.ageBand != null && Math.abs(cand.age - seeker.age) > f.ageBand) return false;
  return true;
}

/** Penalty for a member given the rest of the crew; returns score + human reason. */
function fitIssues(p: Profile, others: Profile[], eventStart: number) {
  const reasons: string[] = [];
  let penalty = 0;
  if (toMin(p.freeFrom) > eventStart - 60) {
    penalty += 3;
    reasons.push(`${p.name} is only free from ${pretty(p.freeFrom)}, after the pre-show meetup`);
  }
  const chill = others.filter((o) => o.vibe !== "loud").length;
  if (p.vibe === "loud" && chill >= others.length / 2) {
    penalty += 2;
    reasons.push(`${p.name} wants a loud night out while most of the crew wants a quiet hang first`);
  }
  const conflicts = others.flatMap((o) => shared(p, o).conflicts);
  if (conflicts.length) {
    penalty += conflicts.length;
    reasons.push(`${conflicts.length} taste clashes (e.g. ${conflicts[0]})`);
  }
  return { penalty, reasons };
}

const groupScore = (ids: string[]) => {
  const ps = ids.map((i) => profileById(i)!);
  let s = 0;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) s += pairScore(ps[i], ps[j]);
  return s;
};

function heuristicChemistry(seeker: Profile, draft: string[], bench: string[], eventStart: number) {
  const members = [...draft];
  const swaps: Swap[] = [];
  for (let round = 0; round < 2; round++) {
    const crew = [seeker.id, ...members];
    let worst: { id: string; pen: number; reasons: string[] } | null = null;
    for (const id of members) {
      const p = profileById(id)!;
      const others = crew.filter((c) => c !== id).map((c) => profileById(c)!);
      const { penalty, reasons } = fitIssues(p, others, eventStart);
      if (penalty >= 3 && (!worst || penalty > worst.pen)) worst = { id, pen: penalty, reasons };
    }
    if (!worst) break;
    let best: { id: string; score: number } | null = null;
    for (const b of bench) {
      if (members.includes(b)) continue;
      const trial = [seeker.id, ...members.filter((m) => m !== worst!.id), b];
      const bp = profileById(b)!;
      const { penalty } = fitIssues(bp, trial.filter((t) => t !== b).map((t) => profileById(t)!), eventStart);
      const score = groupScore(trial) - penalty * 2;
      if (!best || score > best.score) best = { id: b, score };
    }
    if (!best) break;
    const inP = profileById(best.id)!;
    swaps.push({
      out: worst.id,
      in: best.id,
      reason: `${worst.reasons.join("; ")}. ${inP.name} fits the group better: ${hookSummary(seeker, inP)}.`,
    });
    members[members.indexOf(worst.id)] = best.id;
  }
  return { members, swaps };
}

const compact = (p: Profile) => ({
  id: p.id,
  name: p.name,
  age: p.age,
  gender: p.gender,
  likes: p.likes,
  dislikes: p.dislikes,
  groups: p.groups,
  pastEvents: p.pastEvents,
  friends: p.friends,
  vibe: p.vibe,
  budget: "$".repeat(p.budget),
  freeFrom: p.freeFrom,
});

interface AiCrew {
  draft?: string[];
  swaps?: Swap[];
  final?: string[];
  rationale?: string;
  vibe?: string;
  why?: Record<string, string>;
}

interface AiVenue {
  venueId?: string;
  time?: string;
  reasons?: string[];
}

function planHeuristic(crew: Profile[], eventStart: number, ev: { lat: number; lng: number }): MeetupPlan {
  const latestFree = Math.max(...crew.map((p) => toMin(p.freeFrom)));
  const time = Math.min(Math.max(latestFree, eventStart - 90), eventStart - 45);
  const chill = crew.filter((p) => p.vibe === "chill").length >= crew.length / 2;
  const maxBudget = Math.min(...crew.map((p) => p.budget));
  const matcha = crew.filter((p) => p.likes.includes("Matcha")).length;
  const scored = VENUES.map((v) => {
    const walk = walkMinutes(v, ev);
    let s = 0;
    if (chill ? v.noise === "quiet" : v.noise !== "quiet") s += 3;
    if (v.price <= maxBudget) s += 2;
    if (toMin(v.opensUntil) >= eventStart) s += 1;
    if (walk <= 10) s += 2;
    if (v.kind === "coffee" && matcha >= 3) s += 1.5;
    if (v.noise === "loud" && chill) s -= 3;
    return { v, s, walk };
  }).sort((a, b) => b.s - a.s);
  const { v, walk } = scored[0];
  return {
    venueId: v.id,
    time: fromMin(time - (time % 15)),
    walkToEventMin: walk,
    reasons: [
      `${chill ? "Quiet enough to actually talk" : "Lively but you can still hear each other"}: ${crew.filter((p) => p.vibe === "chill").length} of ${crew.length} prefer a chill pre-show`,
      `${"$".repeat(v.price)}: fits everyone's budget`,
      `${walk} min walk to the show; everyone is free by ${pretty(fromMin(latestFree))}`,
      ...(v.kind === "coffee" && matcha >= 3 ? [`${matcha} of you like matcha. ${v.blurb}`] : []),
    ],
  };
}

export async function* formCrew(eventId: string, seekerId: string, filters: QueueFilters): AsyncGenerator<FormStep> {
  const existing = crewFor(eventId, seekerId);
  if (existing) {
    yield { type: "crew", crew: existing };
    return;
  }
  const ev = EVENTS.find((e) => e.id === eventId);
  const seeker = profileById(seekerId);
  if (!ev || !seeker) {
    yield { type: "error", message: "Unknown event or user" };
    return;
  }
  const eventStart = toMin(ev.startTime);
  const size = Math.min(8, Math.max(6, filters.crewSize || 6));
  const ai = museEnabled();
  const queue = visibleQueue(eventId);
  const myTicket = queue.find((q) => q.userId === seekerId);
  const bucketId = myTicket?.bucketId ?? "soco";
  const bucket = LANDMARKS.find((l) => l.id === bucketId)!;
  const taken = new Set(
    [...state().crews.values()]
      .filter((c) => c.eventId === eventId)
      .flatMap((c) => c.memberIds),
  );

  const inBucket = queue.filter((q) => q.bucketId === bucketId && q.userId !== seekerId && !taken.has(q.userId));
  yield { type: "step", id: "scan", label: `Scanning the queue near ${bucket.name}`, detail: `${inBucket.length + 1} people queued for “${ev.title}” within ~2 km` };
  await sleep(STEP_DELAY);

  const eligible = inBucket
    .filter((q) => passesFilters(seeker, profileById(q.userId)!, filters, q.filters))
    .map((q) => profileById(q.userId)!);
  const filterBits = ["18+ only", filters.womenOnly ? "women & non-binary only" : null, filters.ageBand ? `ages ${seeker.age - filters.ageBand}–${seeker.age + filters.ageBand}` : null]
    .filter(Boolean)
    .join(", ");
  yield { type: "step", id: "filter", label: "Applied safety filters", detail: `${filterBits} → ${eligible.length} eligible` };
  await sleep(STEP_DELAY);

  if (eligible.length < size - 1) {
    yield { type: "error", message: `Only ${eligible.length + 1} compatible people nearby so far. Staying in queue…` };
    return;
  }

  const shortlist = [...eligible].sort((a, b) => tasteScore(seeker, b) - tasteScore(seeker, a)).slice(0, 10);
  yield {
    type: "step",
    id: "shortlist",
    label: `Shortlisted ${shortlist.length} by shared taste`,
    detail: shortlist.slice(0, 5).map((p) => `${p.name} (${hookSummary(seeker, p, 1)})`).join(", ") + "…",
  };
  await sleep(STEP_DELAY);

  // ---- Crew judgment: Muse Spark, validated; heuristic fallback ----
  let draft: string[] = [];
  let swaps: Swap[] = [];
  let final: string[] = [];
  let rationale = "";
  let vibe = "";
  let why: Record<string, string> = {};
  let aiMode: Crew["aiMode"] = "fallback";

  if (ai) {
    yield { type: "step", id: "think", label: "Muse is checking group chemistry", detail: "Looking at the crew as a whole, not just pairs", ai: true };
    const res = await museJson<AiCrew>({
      model: "spark",
      system:
        "You form small friend groups ('crews') of strangers who will go to an event together. You care about the GROUP working, not just pair matches: schedules (everyone must be free ~90 min before the event to meet first), energy (chill vs loud), budgets, and clashes (one person's dislikes vs another's likes). Only use ids from the candidate list. Reply with JSON only.",
      user: JSON.stringify({
        task: `Pick exactly ${size - 1} candidates to join the seeker. First give 'draft' = the ${size - 1} best by raw taste overlap with the seeker. Then do a group chemistry check and swap out anyone who would hurt the group (give a specific, kind, one-sentence reason grounded in the data). 'final' = the crew after swaps (excluding the seeker). 'why' maps each final id to a 6-12 word reason they belong, citing shared specifics. 'vibe' = 2-4 word crew vibe. 'rationale' = one sentence on why this group works.`,
        schema: { draft: ["id"], swaps: [{ out: "id", in: "id", reason: "string" }], final: ["id"], rationale: "string", vibe: "string", why: { id: "string" } },
        event: { title: ev.title, startsAt: ev.startTime, tags: ev.tags },
        seeker: compact(seeker),
        candidates: shortlist.map(compact),
      }),
    });
    const ids = new Set(shortlist.map((p) => p.id));
    const ok =
      res &&
      Array.isArray(res.final) &&
      res.final.length === size - 1 &&
      new Set(res.final).size === size - 1 &&
      res.final.every((id) => ids.has(id));
    if (ok) {
      final = res!.final!;
      draft = (res!.draft ?? []).filter((id) => ids.has(id)).slice(0, size - 1);
      swaps = (res!.swaps ?? []).filter((s) => ids.has(s.in) && ids.has(s.out) && final.includes(s.in) && !final.includes(s.out));
      rationale = res!.rationale ?? "";
      vibe = res!.vibe ?? "";
      why = Object.fromEntries(Object.entries(res!.why ?? {}).filter(([k]) => final.includes(k)));
      aiMode = "muse";
      // Code check: hard constraints the model must not violate.
      const late = final.filter((id) => toMin(profileById(id)!.freeFrom) > eventStart - 45);
      if (late.length) {
        yield { type: "step", id: "guard", label: "Code check overrode the model", detail: `${late.map(first).join(", ")} can't make the meetup. Re-running fallback.` };
        aiMode = "fallback";
      }
    } else {
      yield { type: "step", id: "fallback", label: "Model output failed validation", detail: "Falling back to the deterministic matcher" };
    }
  }

  if (aiMode === "fallback") {
    draft = shortlist.slice(0, size - 1).map((p) => p.id);
    const bench = shortlist.slice(size - 1).map((p) => p.id);
    const r = heuristicChemistry(seeker, draft, bench, eventStart);
    final = r.members;
    swaps = r.swaps;
    const crewPs = [seeker, ...final.map((i) => profileById(i)!)];
    const top = [...new Set(crewPs.flatMap((p) => p.likes))]
      .map((l) => [l, crewPs.filter((p) => p.likes.includes(l)).length] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    const n = crewPs.length;
    rationale =
      top.length === 2 && top[0][1] === n && top[1][1] === n
        ? `All ${n} of you love ${top[0][0]} and ${top[1][0]}, and everyone wants a low-key hang before the show.`
        : `${top.map(([l, c]) => `${c} of ${n} love ${l}`).join(", ")}, and everyone wants a low-key hang before the show.`;
    vibe = "Cozy indie kids";
    why = Object.fromEntries(final.map((id) => [id, hookSummary(seeker, profileById(id)!, 2)]));
  }

  if (draft.length) {
    yield { type: "draft", memberIds: draft };
    yield { type: "step", id: "draft", label: "Drafted a crew by taste", detail: draft.map(first).join(", ") };
    await sleep(STEP_DELAY);
  }
  for (const s of swaps) {
    yield { type: "swap", swap: s };
    yield { type: "step", id: `swap-${s.out}`, label: `Swapped ${first(s.out)} → ${first(s.in)}`, detail: s.reason, ai: aiMode === "muse" };
    await sleep(STEP_DELAY * 1.5);
  }
  yield { type: "step", id: "locked", label: `Crew locked: ${final.length + 1} people`, detail: rationale, ai: aiMode === "muse" };
  await sleep(STEP_DELAY);

  // ---- Meetup: Muse Spark picks, code validates ----
  const crewPs = [seeker, ...final.map((i) => profileById(i)!)];
  const fallbackPlan = planHeuristic(crewPs, eventStart, ev);
  let plan = fallbackPlan;
  if (aiMode === "muse") {
    const latestFree = Math.max(...crewPs.map((p) => toMin(p.freeFrom)));
    const r = await museJson<AiVenue>({
      model: "spark",
      system: "You pick a pre-event meetup spot for a group of strangers meeting for the first time. It must be public, easy to talk in, affordable for everyone, and walkable to the event. Reply with JSON only.",
      user: JSON.stringify({
        schema: { venueId: "string", time: "HH:MM", reasons: ["3 short, specific reasons citing the group's data"] },
        event: { title: ev.title, startsAt: ev.startTime },
        timeWindow: { earliest: fromMin(latestFree), latest: fromMin(eventStart - 45) },
        crew: crewPs.map((p) => ({ name: p.name, vibe: p.vibe, budget: "$".repeat(p.budget), freeFrom: p.freeFrom, likes: p.likes.slice(0, 5), dislikes: p.dislikes })),
        venues: VENUES.map((v) => ({ id: v.id, name: v.name, kind: v.kind, noise: v.noise, price: "$".repeat(v.price), opensUntil: v.opensUntil, walkToEventMin: walkMinutes(v, ev), blurb: v.blurb })),
      }),
    });
    const v = VENUES.find((x) => x.id === r?.venueId);
    if (v && r?.time && /^\d{2}:\d{2}$/.test(r.time)) {
      const t = Math.min(Math.max(toMin(r.time), latestFree), eventStart - 45);
      plan = { venueId: v.id, time: fromMin(t), walkToEventMin: walkMinutes(v, ev), reasons: (r.reasons ?? fallbackPlan.reasons).slice(0, 4) };
    }
  }
  const venue = VENUES.find((v) => v.id === plan.venueId)!;
  yield { type: "step", id: "venue", label: `Meetup: ${venue.name} at ${pretty(plan.time)}`, detail: plan.reasons.join(" · "), ai: aiMode === "muse" };
  await sleep(STEP_DELAY);

  const crew: Crew = {
    id: `crew-${eventId}-${Date.now().toString(36)}`,
    eventId,
    bucketId,
    memberIds: crewPs.map((p) => p.id),
    seekerId,
    rationale,
    vibe,
    whyMember: why,
    swaps,
    plan,
    acceptAt: {},
    arriveAt: {},
    chat: [],
    createdAt: Date.now(),
    aiMode,
  };
  saveCrew(crew);
  yield { type: "crew", crew };
}

