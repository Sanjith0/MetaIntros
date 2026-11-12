import { z } from "zod";
import {
  ChatMessage,
  Id,
  IsoTime,
  MutualPair,
  PairMessage,
  Spotted,
  TableMessage,
  Verdict,
} from "./schemas";

/**
 * The realtime event catalogue. Every event travels in an envelope that
 * says who may receive it. The SSE stream filters by audience, so a
 * private payload (agent.verdict) never reaches another member's browser.
 */

export const EVENT_TYPES = [
  "queue.joined",
  "queue.invite",
  "queue.tick",
  "party.forming",
  "party.dissolved",
  "party.nomatch",
  "party.seat",
  "party.switched",
  "agent.verdict",
  "table.message",
  "pair.message",
  "plan.unavailable",
  "plan.locked",
  "match.found",
  "chat.message",
  "member.arrived",
  "door.update",
  "member.spotted",
  "runitback.mutual",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const QueueJoinedPayload = z.object({
  entryId: Id,
  userId: Id,
  eventId: Id.nullable(),
  landmark: z.string(),
});

/** A friend asked you to queue together (duo queue). */
export const QueueInvitePayload = z.object({
  fromId: Id,
  toId: Id,
  eventId: Id,
  /** Set when a standing party is queuing together again. */
  groupOf: Id.optional(),
});

export const QueueTickPayload = z.object({
  userId: Id,
  waitingSeconds: z.number().int().min(0),
  inBucket: z.number().int().min(0),
  needed: z.number().int().min(0),
});

export const PartyFormingPayload = z.object({
  partyId: Id,
  memberIds: z.array(Id).length(5),
  landmark: z.string(),
});

/** Deliberately strict: a reason field (or anything else) fails the
 *  contract. The table only ever learns that a plan is unavailable. */
export const PlanUnavailablePayload = z
  .object({
    partyId: Id,
    planId: Id,
    round: z.number().int().min(1).max(3),
  })
  .strict();

/** Someone left before the plan was set. Deliberately strict: it never says who. */
export const PartyDissolvedPayload = z
  .object({
    partyId: Id,
  })
  .strict();

/** F54: the party switched to plan B. Who asked is never carried. */
export const PartySwitchedPayload = z
  .object({
    partyId: Id,
  })
  .strict();

/** F42: after the lock, one person couldn't make it (and maybe someone new joined). No name, no reason. */
export const PartySeatPayload = z
  .object({
    partyId: Id,
    refilled: z.boolean(),
  })
  .strict();

/** No plan fit all five. Like party.dissolved, it can't carry a reason or a name. */
export const PartyNoMatchPayload = z
  .object({
    partyId: Id,
  })
  .strict();

/** F37: finding each other at the venue. Only what this person chose to share: how late, or where to meet. */
export const DoorUpdatePayload = z
  .object({
    partyId: Id,
    userId: Id,
    lateMinutes: z.number().int().min(0).max(120).nullable(),
    meetSpot: z.string().max(80).nullable(),
    /** F59: this person headed home. */
    headedHome: z.boolean().optional(),
  })
  .strict();

export const PlanLockedPayload = z.object({
  partyId: Id,
  planId: Id,
  lockedBy: z.enum(["signatures", "fallback"]),
  lockedAt: IsoTime,
});

export const MatchFoundPayload = z.object({
  partyId: Id,
  planId: Id,
  eventId: Id,
  title: z.string(),
  venueName: z.string(),
  start: z.string(),
  chatId: Id,
  lockedAt: IsoTime,
});

export const MemberArrivedPayload = z.object({
  partyId: Id,
  userId: Id,
  at: IsoTime,
});

export const PAYLOADS = {
  "queue.joined": QueueJoinedPayload,
  "queue.invite": QueueInvitePayload,
  "queue.tick": QueueTickPayload,
  "party.forming": PartyFormingPayload,
  "party.dissolved": PartyDissolvedPayload,
  "party.nomatch": PartyNoMatchPayload,
  "party.seat": PartySeatPayload,
  "party.switched": PartySwitchedPayload,
  "agent.verdict": Verdict,
  "table.message": TableMessage,
  "pair.message": PairMessage,
  "plan.unavailable": PlanUnavailablePayload,
  "plan.locked": PlanLockedPayload,
  "match.found": MatchFoundPayload,
  "chat.message": ChatMessage,
  "member.arrived": MemberArrivedPayload,
  "door.update": DoorUpdatePayload,
  "member.spotted": Spotted,
  "runitback.mutual": MutualPair,
} as const satisfies Record<EventType, z.ZodType>;

export type PayloadOf<T extends EventType> = z.infer<(typeof PAYLOADS)[T]>;

export const Audience = z.union([
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("users"), userIds: z.array(Id).min(1) }),
]);
export type Audience = z.infer<typeof Audience>;

const envelope = <T extends EventType>(type: T) =>
  z.object({
    id: Id,
    seq: z.number().int().min(0),
    at: IsoTime,
    type: z.literal(type),
    audience: Audience,
    /** Also shown on the /stage projector view. */
    stage: z.boolean(),
    payload: PAYLOADS[type],
  });

export const PQEvent = z.discriminatedUnion("type", [
  envelope("queue.joined"),
  envelope("queue.invite"),
  envelope("queue.tick"),
  envelope("party.forming"),
  envelope("party.dissolved"),
  envelope("party.nomatch"),
  envelope("party.seat"),
  envelope("party.switched"),
  envelope("agent.verdict"),
  envelope("table.message"),
  envelope("pair.message"),
  envelope("plan.unavailable"),
  envelope("plan.locked"),
  envelope("match.found"),
  envelope("chat.message"),
  envelope("member.arrived"),
  envelope("door.update"),
  envelope("member.spotted"),
  envelope("runitback.mutual"),
]);
export type PQEvent = z.infer<typeof PQEvent>;
export type PQEventOf<T extends EventType> = Extract<PQEvent, { type: T }>;
