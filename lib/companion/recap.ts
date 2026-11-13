/**
 * What one person gets to see about how their squad was decided, and how that compares with
 * ranking people by similarity score. Pure: built from a finished room.
 *
 * Privacy: a person sees their own Companion's notes about others, never anyone else's notes
 * about them, and a reason for leaving someone out comes only from their own Companion.
 */
import { makePairScorer } from "@/lib/match/compat";
import { pairAllowed } from "@/lib/match/safety";
import type { Person } from "@/lib/profile/load";
import type { Verdict } from "./orchestrator";
import { pairKey, type RoomParty, type RoomResult } from "./room";
import type { ThreadMsg } from "./rounds";

export interface RecapLine {
  from: "me" | "them";
  kind: ThreadMsg["kind"];
  say: string;
  blocked: boolean;
}

export interface Comparison {
  id: string;
  similarity: number;
  /** why, in the person's own Companion's words (or a neutral line) */
  reason: string;
}

export interface Recap {
  roomSize: number;
  circleTheme: string;
  /** how many people this person's Companion talked with */
  talkedWith: number;
  squad: { id: string; deep: boolean; notes: Verdict | null; thread: RecapLine[] }[];
  groupChat: { from: string; say: string }[];
  numbers: {
    /** who a similarity ranking would have put with this person (best first) */
    similarityPick: { id: string; similarity: number }[];
    companionPick: string[];
    /** high similarity, but not in the squad */
    passedOver: Comparison[];
    /** in the squad, but a similarity ranking would have left them out */
    chosenAnyway: Comparison[];
    agreed: number;
  };
}

const first = (p: Pick<Person, "name">) => p.name.split(" ")[0];

/** The similarity score this app used before the Companion engine (profile vectors + overlap), 0-100. */
export function similarity(a: Person, b: Person, score = makePairScorer()): number {
  return Math.round(score(a, b).score * 100);
}

export function buildRecap(me: string, party: RoomParty, room: RoomResult, people: Map<string, Person>, roomIds: string[]): Recap {
  const score = makePairScorer();
  const mine = room.verdicts.get(me) ?? new Map<string, Verdict>();
  const circle = room.circles.find((c) => c.id === party.circleId);
  const others = party.members.filter((m) => m !== me);
  const p = people.get(me)!;

  const thread = (other: string): RecapLine[] =>
    (room.threads.get(pairKey(me, other)) ?? []).map((m) => ({ from: m.from === me ? "me" : "them", kind: m.kind, say: m.say, blocked: m.blocked }));

  const ranked = roomIds
    .filter((id) => id !== me && people.has(id) && pairAllowed(p, people.get(id)!))
    .map((id) => ({ id, similarity: similarity(p, people.get(id)!, score) }))
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id));
  const similarityPick = ranked.slice(0, others.length);
  const simIds = new Set(similarityPick.map((x) => x.id));
  const squadIds = new Set(others);

  const chosenScores = others.map((id) => mine.get(id)?.score).filter((v): v is number => v !== undefined);
  const chosenAvg = chosenScores.length ? Math.round(chosenScores.reduce((a, b) => a + b, 0) / chosenScores.length) : null;
  const passedOver: Comparison[] = similarityPick
    .filter((x) => !squadIds.has(x.id))
    .map((x) => {
      const n = mine.get(x.id);
      const name = first(people.get(x.id)!);
      const concern = n?.concerns[0];
      // Only this person's own Companion's notes explain it; we never say whose Companion declined.
      const reason = concern
        ? `Your Companion noted: ${concern}`
        : n && chosenAvg !== null && n.score < chosenAvg
          ? `After talking, your Companion rated ${name} ${n.score}/100, below the people it chose (${chosenAvg} on average).`
          : `The Companions settled on a squad that worked better as a whole group.`;
      return { id: x.id, similarity: x.similarity, reason };
    });

  const chosenAnyway: Comparison[] = others
    .filter((id) => !simIds.has(id))
    .map((id) => {
      const n = mine.get(id);
      const enjoy = n?.wouldEnjoy[0];
      return {
        id,
        similarity: ranked.find((r) => r.id === id)?.similarity ?? similarity(p, people.get(id)!, score),
        reason: enjoy ? `Your Companion found: ${enjoy}` : `Your Companions agreed ${first(people.get(id)!)} belongs in this squad.`,
      };
    });

  return {
    roomSize: roomIds.length,
    circleTheme: circle?.theme ?? "",
    talkedWith: [...room.threads.keys()].filter((k) => k.split("|").includes(me)).length,
    squad: others.map((id) => ({ id, deep: room.deep.includes(pairKey(me, id)), notes: mine.get(id) ?? null, thread: thread(id) })),
    groupChat: party.groupChat,
    numbers: {
      similarityPick,
      companionPick: others,
      passedOver,
      chosenAnyway,
      agreed: others.filter((id) => simIds.has(id)).length,
    },
  };
}
