// Shared contracts. Owned by the "spine" lane; change via PR with a contract-change label.

export type Gender = "woman" | "man" | "nonbinary";

export interface Profile {
  id: string;
  name: string; // first name + last initial until reveal
  lastName: string;
  age: number;
  gender: Gender;
  pronouns: string;
  hometown: string;
  school: string;
  work: string;
  bio: string;
  likes: string[]; // pages / artists / shows / foods liked on Facebook
  dislikes: string[];
  groups: string[]; // Facebook Groups they're in
  pastEvents: string[]; // Facebook Events they attended
  friends: string[]; // full names of Facebook friends (used for mutual friends)
  vibe: "chill" | "social" | "loud"; // preferred pre-event energy
  budget: 1 | 2 | 3;
  freeFrom: string; // "HH:MM" on event day, local
  lat: number;
  lng: number;
  hue: number; // avatar color
}

export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Venue {
  id: string;
  name: string;
  kind: "coffee" | "bar" | "food" | "park";
  noise: "quiet" | "medium" | "loud";
  price: 1 | 2 | 3;
  opensUntil: string; // "HH:MM"
  lat: number;
  lng: number;
  blurb: string;
}

export interface FbEvent {
  id: string;
  title: string;
  host: string;
  venueName: string;
  date: string; // ISO date
  startTime: string; // "HH:MM"
  lat: number;
  lng: number;
  tags: string[];
  goingCount: number;
  interestedCount: number;
  cover: string; // css gradient
  description: string;
}

export interface QueueFilters {
  womenOnly: boolean;
  ageBand: number | null; // +/- years, null = any
  crewSize: number; // 6..8
}

export interface QueueTicket {
  userId: string;
  eventId: string;
  bucketId: string;
  filters: QueueFilters;
  joinedAt: number;
  interests?: string[];
}

export interface Swap {
  out: string;
  in: string;
  reason: string;
}

export interface MeetupPlan {
  venueId: string;
  time: string; // "HH:MM"
  walkToEventMin: number;
  reasons: string[];
}

export interface Hook {
  text: string;
  evidence: string; // the shared field, e.g. "likes:Phoebe Bridgers"
}

export interface Icebreaker {
  fromId: string;
  toId: string;
  hooks: Hook[];
  opener: string;
  mutualFriends: string[];
}

export interface ChatMessage {
  id: string;
  authorId: string; // profile id or "assistant"
  text: string;
  at: number;
  simulated?: boolean;
}

export interface Crew {
  id: string;
  eventId: string;
  bucketId: string;
  memberIds: string[];
  seekerId: string;
  rationale: string;
  vibe: string;
  whyMember: Record<string, string>;
  swaps: Swap[];
  plan: MeetupPlan;
  acceptAt: Record<string, number>; // userId -> time they accept (seeded crewmates accept on a short delay)
  arriveAt: Record<string, number>;
  chat: ChatMessage[];
  createdAt: number;
  aiMode: "muse" | "fallback";
}

export type FormStep =
  | { type: "step"; id: string; label: string; detail?: string; ai?: boolean }
  | { type: "draft"; memberIds: string[] }
  | { type: "swap"; swap: Swap }
  | { type: "crew"; crew: Crew }
  | { type: "error"; message: string };

/** Crew as returned to clients: timestamps resolved to lists. */
export interface CrewView extends Crew {
  accepted: string[];
  arrived: string[];
  allAccepted: boolean;
}
