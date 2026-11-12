// In-memory server state. Kept on globalThis so all route bundles share it in dev.
import { DEMO_EVENT, LATE_JOINERS, PREQUEUED, profileById } from "@/data/seed";
import { bucketFor } from "@/lib/geo";
import type { Crew, CrewView, QueueTicket } from "@/lib/types";

interface State {
  queue: QueueTicket[];
  crews: Map<string, Crew>;
  icebreakers: Map<string, unknown>;
}

const g = globalThis as unknown as { __crews?: State };

function fresh(): State {
  const now = Date.now();
  return {
    queue: PREQUEUED.map((id, i) => ticket(id, DEMO_EVENT, now - (i + 1) * 60_000)),
    crews: new Map(),
    icebreakers: new Map(),
  };
}

function ticket(userId: string, eventId: string, joinedAt: number): QueueTicket {
  const p = profileById(userId)!;
  return {
    userId,
    eventId,
    bucketId: bucketFor(p).id,
    filters: { womenOnly: false, ageBand: null, crewSize: 6 },
    joinedAt,
  };
}

export const state = () => (g.__crews ??= fresh());

export function resetState() {
  g.__crews = fresh();
}

export function joinQueue(t: Omit<QueueTicket, "bucketId" | "joinedAt">) {
  const s = state();
  const p = profileById(t.userId);
  if (!p) throw new Error("unknown user");
  s.queue = s.queue.filter((q) => !(q.userId === t.userId && q.eventId === t.eventId));
  const full: QueueTicket = { ...t, bucketId: bucketFor(p).id, joinedAt: Date.now() };
  s.queue.push(full);
  return full;
}

/** Demo mode: late joiners trickle into the queue over the next few seconds. */
export function demoFill(eventId: string, spacingMs = 450) {
  const s = state();
  const now = Date.now();
  LATE_JOINERS.forEach((id, i) => {
    if (s.queue.some((q) => q.userId === id && q.eventId === eventId)) return;
    s.queue.push({ ...ticket(id, eventId, now + (i + 1) * spacingMs) });
  });
}

export function visibleQueue(eventId: string) {
  const now = Date.now();
  return state().queue.filter((q) => q.eventId === eventId && q.joinedAt <= now);
}

export function getCrew(id: string) {
  return state().crews.get(id);
}

export function saveCrew(c: Crew) {
  state().crews.set(c.id, c);
}

export function crewFor(eventId: string, userId: string) {
  return [...state().crews.values()].find((c) => c.eventId === eventId && c.memberIds.includes(userId));
}

export function view(c: Crew): CrewView {
  const now = Date.now();
  const accepted = c.memberIds.filter((id) => (c.acceptAt[id] ?? Infinity) <= now);
  const arrived = c.memberIds.filter((id) => (c.arriveAt[id] ?? Infinity) <= now);
  return { ...c, chat: c.chat.filter((m) => m.at <= now).sort((a, b) => a.at - b.at), accepted, arrived, allAccepted: accepted.length === c.memberIds.length };
}

/** When the seeker acts, seeded crewmates follow over the next few seconds. */
export function cascade(map: Record<string, number>, c: Crew, userId: string, spacingMs: number) {
  const now = Date.now();
  map[userId] = now;
  c.memberIds
    .filter((id) => id !== userId && map[id] == null)
    .forEach((id, i) => (map[id] = now + (i + 1) * spacingMs));
}
