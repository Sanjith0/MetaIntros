/**
 * Hangout planning (pure). For the "new hangout" queue there is no existing event: code builds
 * every option itself — a public spot that's close to *every* member's area, a time inside
 * everyone's shared free time and the spot's hours, and nothing anyone dislikes. The Hangout
 * Planner Agent only chooses among (and names) options that passed here; its pick is re-checked.
 */
import { haversineKm, type LatLng } from "@/lib/geo";
import type { AvailabilityWindow } from "@/lib/profile/builder";
import type { GroupContext } from "./eventFit";

export interface Spot {
  id: string;
  landmarkId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  tags: string[];
  /** what the squad would do there, e.g. "a board game session" */
  activity: string;
  /** opening hours, minutes from local midnight */
  openMin: number;
  closeMin: number;
  durationMin: number;
  /** defaults to true; private places are never offered */
  isPublic?: boolean;
  coverColor?: string;
  coverPattern?: string;
}

export interface HangoutGroup extends Pick<GroupContext, "sharedWindows" | "tagCounts" | "dislikes" | "size"> {
  /** each member's queue area (the place they said they'd meet from) */
  memberAreas: LatLng[];
}

export interface HangoutOption {
  spotId: string;
  ok: boolean;
  score: number;
  startsAt: Date | null;
  endsAt: Date | null;
  /** farthest any member's area is from the spot */
  maxKm: number;
  matchedTags: string[];
  rejections: string[];
  /** true when the group had no shared free time on file and we proposed a default slot */
  assumedTime: boolean;
}

/** A spot counts as "common ground" only if it's within this distance of every member's area. */
export const MAX_HANGOUT_KM = 12;
const LEAD_MIN = 60; // never plan something starting in the next hour
const DAY = 86_400_000;

const roundUp30 = (m: number) => Math.ceil(m / 30) * 30;
const atMinutes = (day: Date, min: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, min);

/** Earliest slot of `durationMin` inside both a shared window and the spot's hours, between now(+lead) and horizon. */
export function findSlot(windows: AvailabilityWindow[], spot: Pick<Spot, "openMin" | "closeMin" | "durationMin">, now: Date, horizon: Date): { startsAt: Date; endsAt: Date } | null {
  const earliest = now.getTime() + LEAD_MIN * 60_000;
  for (let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.getTime() < horizon.getTime(); d = new Date(d.getTime() + DAY)) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const todays = windows.filter((w) => w.dayOfWeek === day.getDay()).sort((a, b) => a.startMin - b.startMin);
    for (const w of todays) {
      const lo = Math.max(w.startMin, spot.openMin);
      const hi = Math.min(w.endMin, spot.closeMin);
      const minFromNow = Math.ceil((earliest - day.getTime()) / 60_000);
      const start = roundUp30(Math.max(lo, minFromNow));
      if (start + spot.durationMin <= hi) {
        const startsAt = atMinutes(day, start);
        if (startsAt.getTime() >= horizon.getTime()) return null;
        return { startsAt, endsAt: atMinutes(day, start + spot.durationMin) };
      }
    }
  }
  return null;
}

/** Default slot when nobody's availability overlaps on file (e.g. live sign-ups): next weekend afternoon. */
function defaultSlot(spot: Spot, now: Date, horizon: Date) {
  const weekendAfternoons = [5, 6, 0].map((dayOfWeek) => ({ dayOfWeek, startMin: 13 * 60, endMin: 20 * 60 }));
  return findSlot(weekendAfternoons, spot, now, horizon);
}

export function scoreHangout(spot: Spot, g: HangoutGroup, now: Date, horizon: Date): HangoutOption {
  const rejections: string[] = [];
  if (spot.isPublic === false) rejections.push("not a public place");
  const maxKm = g.memberAreas.length ? Math.max(...g.memberAreas.map((a) => haversineKm(a, spot))) : 0;
  if (maxKm > MAX_HANGOUT_KM) rejections.push(`too far for someone (${maxKm.toFixed(1)} km)`);
  const disliked = spot.tags.filter((t) => g.dislikes.has(t));
  if (disliked.length) rejections.push(`a member dislikes ${disliked.join(", ")}`);

  let assumedTime = false;
  let slot = findSlot(g.sharedWindows, spot, now, horizon);
  if (!slot && g.sharedWindows.length === 0) {
    slot = defaultSlot(spot, now, horizon);
    assumedTime = Boolean(slot);
  }
  if (!slot) rejections.push("no shared free time while it's open");

  const matchedTags = spot.tags.filter((t) => (g.tagCounts.get(t) ?? 0) > 0).sort((a, b) => (g.tagCounts.get(b) ?? 0) - (g.tagCounts.get(a) ?? 0));
  const interest = Math.min(1.5, matchedTags.reduce((s, t) => s + (g.tagCounts.get(t) ?? 0) / g.size, 0));
  const proximity = Math.max(0, 1 - maxKm / MAX_HANGOUT_KM);
  const soon = slot ? Math.max(0, 1 - (slot.startsAt.getTime() - now.getTime()) / (7 * DAY)) : 0;
  const score = Math.round((interest * 0.65 + proximity * 0.25 + soon * 0.1) * 1000) / 1000;
  return { spotId: spot.id, ok: rejections.length === 0, score, startsAt: slot?.startsAt ?? null, endsAt: slot?.endsAt ?? null, maxKm, matchedTags, rejections, assumedTime };
}

export function rankHangouts(spots: Spot[], g: HangoutGroup, now: Date, horizon: Date): HangoutOption[] {
  return spots
    .map((s) => scoreHangout(s, g, now, horizon))
    .sort((a, b) => Number(b.ok) - Number(a.ok) || b.score - a.score || a.spotId.localeCompare(b.spotId));
}
