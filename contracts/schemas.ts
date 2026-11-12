import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const Id = z.string().min(1).max(80);
export const IsoTime = z.string().min(10); // ISO-8601 string
export const Clock = z.string().regex(/^\d{2}:\d{2}$/); // "23:00"

/** A fact about a person that the person wrote or approved. Every
 *  machine-written sentence must map each claim to one of these ids. */
export const Fact = z.object({
  id: Id,
  ownerId: Id,
  tag: z.string().min(1).max(40), // short topic, e.g. "film photography"
  text: z.string().min(1).max(120), // e.g. "Shoots film on an old point-and-shoot"
  ask: z.string().min(1).max(120), // an approved question others may ask about it
  approved: z.boolean(),
  source: z.enum(["profile", "brief", "fair"]).default("profile"),
});
export type Fact = z.infer<typeof Fact>;

export const Gender = z.enum(["woman", "man", "nonbinary"]);

export const Settings = z.object({
  womenOnly: z.boolean().default(false), // only join all-women parties
  notOnlyWoman: z.boolean().default(false), // never be the only woman
});
export type Settings = z.infer<typeof Settings>;

/* ------------------------------------------------------------------ */
/* People and graph                                                    */
/* ------------------------------------------------------------------ */

export const Profile = z.object({
  id: Id,
  name: z.string().min(1),
  firstName: z.string().min(1),
  age: z.number().int().min(0).max(120),
  gender: Gender,
  pronouns: z.string().min(1),
  city: z.string().min(1),
  homeLandmark: z.string().min(1),
  avatarHue: z.number().int().min(0).max(359),
  facts: z.array(Fact),
  settings: Settings,
  blocks: z.array(Id),
  groupIds: z.array(Id),
});
export type Profile = z.infer<typeof Profile>;

export const Group = z.object({
  id: Id,
  name: z.string().min(1),
  size: z.number().int().min(1),
});
export type Group = z.infer<typeof Group>;

export const FriendEdge = z.tuple([Id, Id]);
export type FriendEdge = z.infer<typeof FriendEdge>;

/** How two party members are connected. Shown to the party only when
 *  both consented at queue time. */
export const Bridge = z.object({
  id: Id,
  a: Id,
  b: Id,
  kind: z.enum(["mutual_friend", "group", "queued_together"]),
  viaId: Id,
  viaName: z.string().min(1),
  groupSize: z.number().int().optional(),
});
export type Bridge = z.infer<typeof Bridge>;

/* ------------------------------------------------------------------ */
/* Events (the Facebook kind)                                          */
/* ------------------------------------------------------------------ */

export const EventItem = z.object({
  id: Id,
  title: z.string().min(1),
  description: z.string().min(1), // free text, as a host would write it
  category: z.string().min(1),
  hostName: z.string().min(1),
  venueName: z.string().min(1),
  venueKind: z.enum(["public", "private"]),
  landmark: z.string().min(1),
  city: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: Clock,
  end: Clock, // may be after midnight, e.g. "01:00"
  priceUsd: z.number().min(0),
  drinkMinimum: z.boolean(),
  coverHue: z.number().int().min(0).max(359),
  interested: z.number().int().min(0),
  going: z.number().int().min(0),
  partyEligible: z.boolean(), // shows the Find my party button
});
export type EventItem = z.infer<typeof EventItem>;

/* ------------------------------------------------------------------ */
/* Brief: one sentence becomes rules, preferences, shareable lines     */
/* ------------------------------------------------------------------ */

export const HardRule = z.discriminatedUnion("kind", [
  z.object({ id: Id, kind: z.literal("end_by"), value: Clock, sourceText: z.string() }),
  z.object({ id: Id, kind: z.literal("max_price"), value: z.number().min(0), sourceText: z.string() }),
  z.object({ id: Id, kind: z.literal("no_drink_minimum"), value: z.literal(true), sourceText: z.string() }),
  z.object({ id: Id, kind: z.literal("public_venue"), value: z.literal(true), sourceText: z.string() }),
]);
export type HardRule = z.infer<typeof HardRule>;

export const Preference = z.object({
  id: Id,
  tag: z.string().min(1), // e.g. "chill", "outdoors", "music"
  weight: z.number().int().min(1).max(3),
  sourceText: z.string(),
});
export type Preference = z.infer<typeof Preference>;

/** A line the owner approved for the party to see. `factIds` must all be
 *  approved facts of the owner. */
export const ShareableLine = z.object({
  id: Id,
  ownerId: Id,
  text: z.string().min(1).max(140),
  factIds: z.array(Id).min(1),
  approved: z.boolean(),
});
export type ShareableLine = z.infer<typeof ShareableLine>;

export const Brief = z.object({
  id: Id,
  ownerId: Id,
  sentence: z.string().min(1).max(280), // private
  hardRules: z.array(HardRule), // private
  preferences: z.array(Preference), // private
  shareable: z.array(ShareableLine),
  source: z.enum(["model", "fallback", "fixture"]),
});
export type Brief = z.infer<typeof Brief>;

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export const TimeWindow = z.object({ start: IsoTime, end: IsoTime });
export type TimeWindow = z.infer<typeof TimeWindow>;

export const QueueEntry = z.object({
  id: Id,
  userId: Id,
  eventId: Id.nullable(),
  landmark: z.string().min(1),
  window: TimeWindow,
  briefId: Id,
  consentBridges: z.boolean(),
  /** A friend this person is queuing with. Both join, and both land in the same party. */
  duoWith: Id.nullable().default(null),
  joinedAt: IsoTime,
  status: z.enum(["waiting", "forming", "matched", "left"]),
});
export type QueueEntry = z.infer<typeof QueueEntry>;

export const Bucket = z.object({
  id: Id,
  landmark: z.string().min(1),
  window: TimeWindow,
  entryIds: z.array(Id),
});
export type Bucket = z.infer<typeof Bucket>;

/* ------------------------------------------------------------------ */
/* Table talk                                                          */
/* ------------------------------------------------------------------ */

export const CandidatePlan = z.object({
  id: Id,
  eventId: Id,
  title: z.string().min(1),
  venueName: z.string().min(1),
  venueKind: z.enum(["public", "private"]),
  landmark: z.string().min(1),
  date: z.string(),
  start: Clock,
  end: Clock,
  priceUsd: z.number().min(0),
  drinkMinimum: z.boolean(),
  tags: z.array(z.string()),
  blurb: z.string().min(1),
});
export type CandidatePlan = z.infer<typeof CandidatePlan>;

/** A line on the shared table. Every source id is either an approved
 *  shareable line of the author, or a neutral phrase id. */
export const TableMessage = z.object({
  id: Id,
  partyId: Id,
  round: z.number().int().min(0).max(3),
  authorId: Id.nullable(), // null = the table itself (code)
  kind: z.enum(["line", "unavailable", "leading", "locked", "system"]),
  text: z.string().min(1).max(200),
  sourceIds: z.array(Id),
  planId: Id.optional(),
  at: IsoTime,
});
export type TableMessage = z.infer<typeof TableMessage>;

export const PairMessage = z.object({
  id: Id,
  partyId: Id,
  pairKey: z.string().min(3),
  fromId: Id.nullable(),
  toId: Id.nullable(),
  kind: z.enum(["exchange", "shared", "opener"]),
  text: z.string().min(1).max(200),
  sourceIds: z.array(Id).min(1),
  at: IsoTime,
});
export type PairMessage = z.infer<typeof PairMessage>;

export const Decision = z.enum(["accept", "reject", "concede", "hold", "sign"]);

/** One agent's private view of one plan in one round. Never broadcast
 *  beyond the owner and the stage. */
export const Verdict = z.object({
  partyId: Id,
  ownerId: Id,
  round: z.number().int().min(1).max(3),
  planId: Id,
  decision: Decision,
  preference: z.number().int().min(1).max(5),
  privateReason: z.string().max(240),
  overriddenByCode: z.boolean().default(false),
});
export type Verdict = z.infer<typeof Verdict>;

export const CodeCheck = z.object({
  partyId: Id,
  planId: Id,
  ownerId: Id.nullable(), // null for party-wide checks (public venue)
  ruleId: Id,
  ruleKind: z.enum(["end_by", "max_price", "no_drink_minimum", "public_venue"]),
  pass: z.boolean(),
  detail: z.string(),
});
export type CodeCheck = z.infer<typeof CodeCheck>;

/* ------------------------------------------------------------------ */
/* Party                                                               */
/* ------------------------------------------------------------------ */

export const Party = z.object({
  id: Id,
  bucketId: Id,
  eventId: Id.nullable(),
  memberIds: z.array(Id).length(5),
  bridges: z.array(Bridge),
  candidatePlanIds: z.array(Id),
  status: z.enum(["forming", "talking", "locked", "failed"]),
  planId: Id.nullable(),
  lockedBy: z.enum(["signatures", "fallback"]).nullable(),
  signatures: z.array(Id),
  chatId: Id.nullable(),
  formedAt: IsoTime,
  lockedAt: IsoTime.nullable(),
});
export type Party = z.infer<typeof Party>;

/** What one owner's agent did, shown only to that owner. */
export const Receipt = z.object({
  partyId: Id,
  ownerId: Id,
  considered: z.array(z.object({ planId: Id, title: z.string(), preference: z.number().int().min(1).max(5) })),
  rejected: z.array(z.object({ planId: Id, title: z.string(), reason: z.string(), byCode: z.boolean() })),
  toldParty: z.array(z.object({ round: z.number().int(), text: z.string(), sourceIds: z.array(Id) })),
  blockedLines: z.number().int().min(0),
  /** Rounds where this owner's agent did not answer in time and the rule-based fallback answered. */
  fallbackRounds: z.array(z.number().int()).default([]),
  sharedFactIds: z.array(Id),
  finalPlanId: Id.nullable(),
});
export type Receipt = z.infer<typeof Receipt>;

/** The at-the-door card: who is in front of you and what to say. */
export const Card = z.object({
  partyId: Id,
  viewerId: Id,
  subjectId: Id,
  subjectName: z.string(),
  bridgeLine: z.string().nullable(),
  sharedLine: z.string().nullable(),
  opener: z.string(),
  sourceIds: z.array(Id).min(1),
});
export type Card = z.infer<typeof Card>;

/* ------------------------------------------------------------------ */
/* The door                                                            */
/* ------------------------------------------------------------------ */

export const Frame = z.object({
  id: Id,
  viewerId: Id,
  partyId: Id,
  capturedAt: IsoTime,
  /** Opaque frame payload. The stub never looks at pixels. */
  image: z.string().max(2_000_000).optional(),
  fixtureKey: z.string().optional(),
});
export type Frame = z.infer<typeof Frame>;

export const Spotted = z.object({
  frameId: Id,
  viewerId: Id,
  partyId: Id,
  subjectId: Id.nullable(),
  method: z.enum(["stub", "tap"]),
  at: IsoTime,
});
export type Spotted = z.infer<typeof Spotted>;

/* ------------------------------------------------------------------ */
/* After                                                               */
/* ------------------------------------------------------------------ */

export const RunItBackPick = z.object({
  partyId: Id,
  pickerId: Id,
  pickedIds: z.array(Id),
  at: IsoTime,
});
export type RunItBackPick = z.infer<typeof RunItBackPick>;

export const MutualPair = z.object({
  partyId: Id,
  a: Id,
  b: Id,
  revealedAt: IsoTime,
});
export type MutualPair = z.infer<typeof MutualPair>;

/* ------------------------------------------------------------------ */
/* Trace: everything the stage replays                                 */
/* ------------------------------------------------------------------ */

export const Trace = z.object({
  id: Id,
  partyId: Id,
  seq: z.number().int().min(0),
  lane: z.enum(["private", "shared"]),
  conversation: z.enum(["table", "pair", "judge", "formation"]),
  actorId: Id.nullable(),
  title: z.string(),
  body: z.string(),
  at: IsoTime,
  /** How the stage colours it: rejections and blocks in red, signatures in green. */
  tone: z.enum(["neutral", "reject", "block", "accept", "sign", "hold", "lock"]).optional(),
  /** Structured facts so the stage can rebuild the board at any point in time. */
  meta: z
    .object({
      round: z.number().int().optional(),
      planId: z.string().optional(),
      decision: z.enum(["accept", "reject", "concede", "hold", "sign"]).optional(),
      kind: z.enum(["open", "verdicts", "unavailable", "leading", "tally", "locked", "line", "pair", "formed"]).optional(),
      source: z.enum(["model", "mock", "fallback", "recorded"]).optional(),
      ms: z.number().optional(),
      /** Why a fallback answered (for example "timeout after 2500 ms"), or where a replay came from. */
      note: z.string().optional(),
    })
    .optional(),
});
export type Trace = z.infer<typeof Trace>;
export type TraceMeta = NonNullable<Trace["meta"]>;

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export const ChatMessage = z.object({
  id: Id,
  chatId: Id,
  senderId: Id.nullable(), // null = system
  kind: z.enum(["user", "system", "pinned", "opener"]),
  text: z.string().min(1).max(1000),
  sourceIds: z.array(Id).default([]),
  at: IsoTime,
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const Chat = z.object({
  id: Id,
  partyId: Id.nullable(),
  title: z.string(),
  memberIds: z.array(Id),
  pinnedMessageId: Id.nullable(),
  /** Party chats close after the event; their messages are deleted then. */
  expiresAt: IsoTime.nullable().default(null),
});
export type Chat = z.infer<typeof Chat>;
