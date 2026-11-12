import { z } from "zod";

export const AGE_BANDS = ["13-15", "16-17", "18-24", "25+"] as const;
export const AgeBand = z.enum(AGE_BANDS);
export type AgeBand = z.infer<typeof AgeBand>;

export const MINOR_BANDS: readonly AgeBand[] = ["13-15", "16-17"];
export const isMinorBand = (b: AgeBand) => MINOR_BANDS.includes(b);

export function ageBandFor(age: number): AgeBand {
  if (age < 13) throw new Error("Users must be at least 13");
  if (age <= 15) return "13-15";
  if (age <= 17) return "16-17";
  if (age <= 24) return "18-24";
  return "25+";
}

export const Gender = z.enum(["woman", "man", "nonbinary"]);
export type Gender = z.infer<typeof Gender>;

export const LocationSource = z.enum(["seed", "gps", "manual"]);
export type LocationSource = z.infer<typeof LocationSource>;

export const ChatType = z.enum(["direct", "group", "squad"]);
export type ChatType = z.infer<typeof ChatType>;

export const MessageKind = z.enum(["user", "host", "system"]);
export type MessageKind = z.infer<typeof MessageKind>;

export const FriendshipSource = z.enum(["existing", "queue_up"]);
export type FriendshipSource = z.infer<typeof FriendshipSource>;

export const FriendRequestStatus = z.enum(["pending", "accepted", "declined"]);
export type FriendRequestStatus = z.infer<typeof FriendRequestStatus>;

export const RsvpStatus = z.enum(["interested", "going"]);
export type RsvpStatus = z.infer<typeof RsvpStatus>;

export const QueueStatus = z.enum(["waiting", "matched", "left"]);
export type QueueStatus = z.infer<typeof QueueStatus>;

export const PartyStatus = z.enum(["forming", "confirmed", "completed", "cancelled"]);
export type PartyStatus = z.infer<typeof PartyStatus>;

export const TraceKind = z.enum(["tool_call", "reasoning", "decision", "safety_check"]);
export type TraceKind = z.infer<typeof TraceKind>;

export const MIN_PARTY_SIZE = 2;
export const MAX_PARTY_SIZE = 8;
export const DEFAULT_PARTY_SIZE = 6;
export const PartySize = z.number().int().min(MIN_PARTY_SIZE).max(MAX_PARTY_SIZE);

/** Friendship rows are stored with userAId < userBId. */
export function normalizePair(a: string, b: string): [string, string] {
  if (a === b) throw new Error("Cannot pair a user with themselves");
  return a < b ? [a, b] : [b, a];
}
