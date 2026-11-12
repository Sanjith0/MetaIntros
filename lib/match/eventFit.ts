/**
 * Deterministic event-fit scoring. Used as (a) the offline fallback for event selection and
 * (b) the code-side validator for whatever the Event Selection Agent proposes.
 */
import type { AvailabilityWindow } from "@/lib/profile/builder";
import { haversineKm, type LatLng } from "@/lib/geo";
import { coversRange } from "./availability";

export interface EventLike {
  id: string;
  title: string;
  tags: string[];
  startsAt: Date;
  endsAt: Date;
  lat: number;
  lng: number;
  isPublicVenue: boolean;
  capacity: number;
}

export interface GroupContext {
  sharedWindows: AvailabilityWindow[];
  /** tag → number of members who like it */
  tagCounts: Map<string, number>;
  /** union of member dislikes → who dislikes it */
  dislikes: Map<string, string[]>;
  center: LatLng;
  size: number;
}

export interface EventFit {
  eventId: string;
  ok: boolean;
  score: number;
  reasons: string[];
  rejections: string[];
  matchedTags: string[];
}

export function scoreEvent(e: EventLike, g: GroupContext, now: Date): EventFit {
  const rejections: string[] = [];
  if (!e.isPublicVenue) rejections.push("not a public venue");
  if (e.startsAt <= now) rejections.push("already started");
  if (!coversRange(g.sharedWindows, e.startsAt, e.endsAt)) rejections.push("outside the group's shared free time");
  const disliked = e.tags.filter((t) => g.dislikes.has(t));
  if (disliked.length) rejections.push(`a member dislikes ${disliked.join(", ")}`);
  if (e.capacity < g.size) rejections.push("too small for the squad");

  const matchedTags = e.tags.filter((t) => (g.tagCounts.get(t) ?? 0) > 0);
  const interest = matchedTags.reduce((s, t) => s + (g.tagCounts.get(t) ?? 0) / g.size, 0);
  const km = haversineKm(g.center, e);
  const proximity = Math.max(0, 1 - km / 20);
  const score = Math.round((interest * 0.75 + proximity * 0.25) * 1000) / 1000;
  const reasons = [
    ...matchedTags.map((t) => `${g.tagCounts.get(t)}/${g.size} of you are into ${t}`),
    `${km.toFixed(1)} km from your meeting area`,
  ];
  return { eventId: e.id, ok: rejections.length === 0, score, reasons, rejections, matchedTags };
}

export function rankEvents(events: EventLike[], g: GroupContext, now: Date): EventFit[] {
  return events
    .map((e) => scoreEvent(e, g, now))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score || a.eventId.localeCompare(b.eventId));
}
