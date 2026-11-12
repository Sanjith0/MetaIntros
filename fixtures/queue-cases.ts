import type { Profile, QueueEntry } from "@/contracts";
import { DEMO_PARTY } from "./demo";
import { PROFILES } from "./profiles";

/** Queue fixtures for the formation rules. Each failing case changes one
 *  thing about the valid demo party, so exactly one rule breaks. */

export interface QueueCase {
  name: string;
  expect: "valid" | "size" | "bucket" | "window" | "age" | "blocks" | "women_only" | "not_only_woman" | "bridge";
  members: { profile: Profile; entry: QueueEntry }[];
}

const base = (id: string): Profile => structuredClone(PROFILES.find((p) => p.id === id)!);

export function entryFor(userId: string, i: number, over: Partial<QueueEntry> = {}): QueueEntry {
  return {
    id: `q-${userId}`,
    userId,
    eventId: DEMO_PARTY.entryEventId,
    landmark: DEMO_PARTY.landmark,
    window: { ...DEMO_PARTY.window },
    briefId: `brief-${userId}`,
    consentBridges: true,
    duoWith: null,
    joinedAt: new Date(Date.UTC(2026, 10, 14, 1, i)).toISOString(),
    status: "waiting",
    ...over,
  };
}

const demo = (tweak?: (p: Profile) => Profile | void, entryTweak?: (id: string) => Partial<QueueEntry>) =>
  DEMO_PARTY.memberIds.map((id, i) => {
    const p = base(id);
    const profile = (tweak?.(p) as Profile | undefined) ?? p;
    return { profile, entry: entryFor(profile.id, i, entryTweak?.(id)) };
  });

export const QUEUE_CASES: QueueCase[] = [
  { name: "the demo party is valid", expect: "valid", members: demo() },
  { name: "four people is not a party", expect: "size", members: demo().slice(0, 4) },
  {
    name: "Zoe queued at a different landmark",
    expect: "bucket",
    members: demo(undefined, (id) => (id === "zoe" ? { landmark: "Ferry Building" } : {})),
  },
  {
    name: "Zoe's window is the next morning",
    expect: "window",
    members: demo(undefined, (id) =>
      id === "zoe" ? { window: { start: "2026-11-15T09:00:00-08:00", end: "2026-11-15T12:00:00-08:00" } } : {},
    ),
  },
  {
    name: "Kai is 17",
    expect: "age",
    members: demo((p) => {
      if (p.id === "kai") p.age = 17;
    }),
  },
  {
    name: "Kai has blocked Dev",
    expect: "blocks",
    members: demo((p) => {
      if (p.id === "kai") p.blocks = ["dev"];
    }),
  },
  {
    name: "Ana only joins all-women parties",
    expect: "women_only",
    members: demo((p) => {
      if (p.id === "ana") p.settings = { womenOnly: true, notOnlyWoman: false };
    }),
  },
  {
    name: "Maya would be the only woman",
    expect: "not_only_woman",
    members: demo((p) => {
      if (p.id === "ana" || p.id === "zoe") {
        p.gender = "man";
        p.pronouns = "he/him";
      }
    }),
  },
  {
    name: "Kai is swapped for someone with no mutual friend or small Group",
    expect: "bridge",
    members: demo((p) => (p.id === "kai" ? base("jules") : undefined)),
  },
  {
    name: "a shared 12,000-member Group is not a bridge",
    expect: "bridge",
    // Rafa shares only the big nightlife Group with the demo members.
    members: demo((p) => (p.id === "kai" ? base("rafa") : undefined)),
  },
];
