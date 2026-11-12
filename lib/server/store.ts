import type {
  Brief,
  CandidatePlan,
  Card,
  Chat,
  ChatMessage,
  CodeCheck,
  EventItem,
  Fact,
  MutualPair,
  PairMessage,
  Party,
  PQEvent,
  Profile,
  QueueEntry,
  Receipt,
  RunItBackPick,
  Spotted,
  TableMessage,
  Trace,
  Verdict,
} from "@/contracts";
import { EVENTS, PROFILES } from "@/fixtures";

export type Rsvp = "interested" | "going";

/** All app state lives in memory, on globalThis so that Next's separate
 *  module instances (route handlers, server components, HMR) share it. */
export interface Store {
  profiles: Map<string, Profile>;
  events: Map<string, EventItem>;
  rsvps: Map<string, Map<string, Rsvp>>; // eventId -> userId -> rsvp
  queue: QueueEntry[];
  briefs: Map<string, Brief>; // briefId -> brief
  briefFacts: Map<string, Fact>; // facts created from briefs (approved by owner)
  parties: Map<string, Party>;
  plans: Map<string, CandidatePlan>;
  verdicts: Verdict[];
  codeChecks: CodeCheck[];
  /** Public lines the verifier blocked. Stage-only. */
  blockedLines: { partyId: string; ownerId: string; round: number; text: string; reason: string }[];
  table: TableMessage[];
  pairs: PairMessage[];
  traces: Trace[];
  receipts: Map<string, Receipt>; // `${partyId}:${ownerId}`
  cards: Card[];
  chats: Map<string, Chat>;
  messages: ChatMessage[];
  arrivals: Map<string, Set<string>>; // partyId -> userIds
  spotted: Spotted[];
  picks: RunItBackPick[];
  mutuals: MutualPair[];
  /** When each phone showed MATCH FOUND (server clock). */
  acks: { userId: string; partyId: string; shownAt: number; lagMs: number; sound: string; vibrate: string }[];
  /** Demo operator controls: parties to fast-forward, parties to lock now. */
  operator: { fastForward: Set<string>; forceLock: Set<string>; cancelled: Set<string> };
  /** Run it back: groups of 3+ who all picked each other, with their chat that doesn't close. */
  standing: Map<string, { memberIds: string[]; chatId: string }>;
  /** Safety reports. Stored for a human review queue; never shown in the app, never told to the subject. */
  reports: { id: string; reporterId: string; subjectId: string; partyId: string | null; reason: string; note: string; at: string }[];
  /** The exact prompts each agent received, for the projector: `${partyId}:${ownerId}:${round}`. */
  prompts: Map<string, { system: string; user: string }>;
  /** Five-person sets whose rules left no plan: formation never puts them together again. Sorted ids joined by commas. */
  avoidSets: Set<string>;
  /** After a no-match: people whose own rules closed every plan there (told only themselves). partyId -> userIds. */
  nothingFits: Map<string, string[]>;
  /** People who asked to forget their private data from a party: `${partyId}:${userId}`. */
  forgotten: Set<string>;
  /** F37: per party, who said they're running late (minutes) and where to meet. */
  door: Map<string, { late: Record<string, number>; meet: { text: string; by: string } | null }>;
  /** F39: what each person's agent remembers about plans they liked, with their OK. Never about people. */
  memory: Map<string, { tag: string; weight: number; from: string }[]>;
  /** F42: people who can't make a locked plan and weren't replaced: `${partyId}:${userId}`. */
  dropped: Set<string>;
  /** Every agent turn's source and latency (for receipts and the stage). */
  agentCalls: { partyId: string; ownerId: string; round: number; source: string; ms: number; note: string | null }[];
  events_log: PQEvent[];
  seq: number;
  idSeq: number;
  version: number;
}

import { AsyncLocalStorage } from "node:async_hooks";

const g = globalThis as unknown as { __pq?: Store; __pqAls?: AsyncLocalStorage<{ s: Store }>; __pqVersionSeq?: number };
/** Isolated runs (the /evals comparison) get their own store through async context, never by swapping the global one. */
const als = (g.__pqAls ??= new AsyncLocalStorage<{ s: Store }>());

function fresh(): Store {
  const s: Store = {
    profiles: new Map(PROFILES.map((p) => [p.id, structuredClone(p)])),
    events: new Map(EVENTS.map((e) => [e.id, structuredClone(e)])),
    rsvps: new Map(),
    queue: [],
    briefs: new Map(),
    briefFacts: new Map(),
    parties: new Map(),
    plans: new Map(),
    verdicts: [],
    codeChecks: [],
    blockedLines: [],
    table: [],
    pairs: [],
    traces: [],
    receipts: new Map(),
    cards: [],
    chats: new Map(),
    messages: [],
    arrivals: new Map(),
    spotted: [],
    picks: [],
    mutuals: [],
    acks: [],
    agentCalls: [],
    standing: new Map(),
    reports: [],
    prompts: new Map(),
    avoidSets: new Set(),
    nothingFits: new Map(),
    forgotten: new Set(),
    door: new Map(),
    memory: new Map(),
    dropped: new Set(),
    operator: { fastForward: new Set(), forceLock: new Set(), cancelled: new Set() },
    events_log: [],
    seq: 0,
    idSeq: 0,
    // Unique across every store ever made (live or isolated), since runs are cached by version.
    version: (g.__pqVersionSeq = (g.__pqVersionSeq ?? 0) + 1),
  };
  seedChats(s);
  return s;
}

export function store(): Store {
  const iso = als.getStore();
  if (iso) return iso.s;
  if (!g.__pq) g.__pq = fresh();
  return g.__pq;
}

export function resetStore(): Store {
  const iso = als.getStore();
  if (iso) {
    iso.s = fresh();
    return iso.s;
  }
  g.__pq = fresh();
  return g.__pq;
}

/** Run work against its own throwaway store. Concurrent requests keep using the real one. */
export function runIsolated<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ s: fresh() }, fn);
}

export const isIsolated = () => !!als.getStore();

/** Start something (a long-lived timer) outside any isolated run, so it never binds to one. */
export function outsideIsolation<T>(fn: () => T): T {
  return als.exit(fn);
}

export function nextId(prefix: string): string {
  const s = store();
  s.idSeq += 1;
  return `${prefix}-${s.idSeq.toString(36)}`;
}

export const nowIso = () => new Date().toISOString();

export function profile(id: string): Profile {
  const p = store().profiles.get(id);
  if (!p) throw new Error(`unknown profile ${id}`);
  return p;
}

/** Every fact a person has approved, from their profile or their brief. */
export function approvedFacts(ownerId: string): Fact[] {
  const s = store();
  const fromProfile = s.profiles.get(ownerId)?.facts ?? [];
  const fromBrief = [...s.briefFacts.values()].filter((f) => f.ownerId === ownerId);
  return [...fromProfile, ...fromBrief].filter((f) => f.approved);
}

export function factById(id: string): Fact | undefined {
  const s = store();
  const b = s.briefFacts.get(id);
  if (b) return b;
  for (const p of s.profiles.values()) {
    const f = p.facts.find((x) => x.id === id);
    if (f) return f;
  }
  return undefined;
}

/* A Groups-based chat so Messenger has something before any party forms. */
function seedChats(s: Store) {
  const t = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();
  s.chats.set("chat-portuguese", {
    id: "chat-portuguese",
    partyId: null,
    title: "Portuguese Practice SF",
    memberIds: ["maya", "zoe", "leo", "elena", "yara"],
    pinnedMessageId: "m-seed-0",
    expiresAt: null,
  });
  const lines: [string | null, ChatMessage["kind"], string, number][] = [
    [null, "pinned", "Practice night is the second Thursday of every month.", 300],
    ["leo", "user", "Who's coming Thursday?", 62],
    ["elena", "user", "Me! I'll bring the flashcards", 58],
    ["zoe", "user", "Count me in", 41],
    ["yara", "user", "Running late but I'll be there by 7", 12],
  ];
  lines.forEach(([sender, kind, text, ago], i) =>
    s.messages.push({ id: `m-seed-${i}`, chatId: "chat-portuguese", senderId: sender, kind, text, sourceIds: [], at: t(ago) }),
  );
}
