import { z } from "zod";

/**
 * Zod schemas for our mock Graph API payloads. Fields without an `x_` prefix mirror
 * real Graph API edges (`/me`, `/me/likes`, `/me/groups`, `/me/music`, `/me/events`,
 * `/me/friends`). `x_`-prefixed edges are mock extensions for data Facebook doesn't
 * expose through Graph (dislikes, availability, Queue Up safety preferences).
 */

const Paging = z
  .object({ cursors: z.object({ before: z.string(), after: z.string() }) })
  .optional();

const edge = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item), paging: Paging });

export const GraphPage = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  created_time: z.string().optional(),
});
export type GraphPage = z.infer<typeof GraphPage>;

export const GraphGroup = z.object({ id: z.string(), name: z.string(), privacy: z.enum(["OPEN", "CLOSED", "SECRET"]) });
export const GraphEvent = z.object({
  id: z.string(),
  name: z.string(),
  start_time: z.string(),
  rsvp_status: z.enum(["attending", "maybe", "declined", "unsure"]),
  place: z.object({ name: z.string() }).optional(),
});
export const GraphFriend = z.object({ id: z.string(), name: z.string() });

export const AvailabilityBlock = z.object({
  day: z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]),
  /** "HH:MM", 24h; end may be "24:00" */
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});
export type AvailabilityBlock = z.infer<typeof AvailabilityBlock>;

export const GraphUser = z.object({
  id: z.string(),
  name: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  /** Graph format MM/DD/YYYY */
  birthday: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  gender: z.enum(["female", "male", "custom"]).nullable(),
  location: z.object({ name: z.string(), latitude: z.number(), longitude: z.number() }),
  picture: z.object({ data: z.object({ color: z.string() }) }),
  likes: edge(GraphPage),
  groups: edge(GraphGroup),
  music: edge(GraphPage),
  events: edge(GraphEvent),
  friends: edge(GraphFriend).extend({ summary: z.object({ total_count: z.number() }) }),
  x_not_interested: edge(GraphPage),
  x_availability: edge(AvailabilityBlock),
  x_preferences: z.object({ women_only_party: z.boolean() }),
  /** The person's own intro line (Graph `about`). Optional: live sign-ups have none. */
  about: z.string().optional(),
  /** Mock extension: profile details a person fills in on Facebook, plus how they come across. */
  x_profile: z
    .object({
      work: z.string(),
      hometown: z.string(),
      /** three short personality words */
      traits: z.array(z.string()),
      /** how they talk and socialise, third person, no gendered pronouns */
      voice: z.string(),
    })
    .optional(),
  /** Seed-only label used by tests; never shown in UI. */
  x_cluster: z.string().optional(),
});
export type GraphUser = z.infer<typeof GraphUser>;

export const DAY_INDEX: Record<AvailabilityBlock["day"], number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
export const minToHhmm = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

export function ageFromBirthday(birthday: string, now: Date): number {
  const [mm, dd, yyyy] = birthday.split("/").map(Number);
  let age = now.getFullYear() - yyyy;
  const m = now.getMonth() + 1;
  if (m < mm || (m === mm && now.getDate() < dd)) age -= 1;
  return age;
}

export function genderFromGraph(g: GraphUser["gender"]): "woman" | "man" | "nonbinary" | null {
  if (g === "female") return "woman";
  if (g === "male") return "man";
  if (g === "custom") return "nonbinary";
  return null;
}
