import { z } from "zod";
import { AgeBand, Gender } from "@/lib/domain/enums";
import type { GraphUser } from "@/lib/graph/schema";
import { SIGNUP_CHIPS, VOCAB_BY_TAG } from "@/lib/graph/vocabulary";
import { hashString } from "@/lib/rng";

export const AVAIL_SLOTS = [
  { id: "fri-eve", label: "Fri evening", day: "fri", start: "17:00", end: "24:00" },
  { id: "sat-am", label: "Sat morning", day: "sat", start: "07:00", end: "12:00" },
  { id: "sat-pm", label: "Sat afternoon", day: "sat", start: "12:00", end: "17:00" },
  { id: "sat-eve", label: "Sat evening", day: "sat", start: "17:00", end: "24:00" },
  { id: "sun-am", label: "Sun morning", day: "sun", start: "07:00", end: "12:00" },
  { id: "sun-pm", label: "Sun afternoon", day: "sun", start: "12:00", end: "17:00" },
  { id: "sun-eve", label: "Sun evening", day: "sun", start: "17:00", end: "22:00" },
] as const;

const chipTags = SIGNUP_CHIPS.map((c) => c.tag) as [string, ...string[]];
const slotIds = AVAIL_SLOTS.map((s) => s.id) as [string, ...string[]];

export const SignupInput = z
  .object({
    name: z.string().trim().min(2).max(40),
    ageBand: AgeBand,
    gender: Gender.nullable(),
    womenOnlyParty: z.boolean().default(false),
    interests: z.array(z.enum(chipTags)).min(5).max(15),
    dislikes: z.array(z.enum(chipTags)).max(6).default([]),
    availability: z.array(z.enum(slotIds)).min(1),
  })
  .refine((v) => !v.womenOnlyParty || v.gender === "woman" || v.gender === "nonbinary", {
    message: "Women-only parties are available to women and non-binary users",
    path: ["womenOnlyParty"],
  })
  .refine((v) => v.dislikes.every((d) => !v.interests.includes(d)), { message: "Interest and dislike overlap", path: ["dislikes"] });
export type SignupInput = z.infer<typeof SignupInput>;

const BAND_AGE: Record<AgeBand, number> = { "13-15": 14, "16-17": 16, "18-24": 21, "25+": 28 };

/** Build the same Graph-shaped payload a persona has, so live users share the pipeline. */
export function graphFromSignup(id: string, input: SignupInput, now = new Date()): GraphUser {
  const [first, ...rest] = input.name.split(/\s+/);
  const pages = input.interests.flatMap((t) => {
    const v = VOCAB_BY_TAG.get(t)!;
    return v.pages.slice(0, 2).map((p) => ({ id: `pg_${hashString(p)}`, name: p, category: v.category, created_time: now.toISOString() }));
  });
  const groups = input.interests
    .map((t) => VOCAB_BY_TAG.get(t)!.groups?.[0])
    .filter((g): g is string => Boolean(g))
    .slice(0, 4)
    .map((g) => ({ id: `gr_${hashString(g)}`, name: g, privacy: "OPEN" as const }));
  const music = input.interests
    .flatMap((t) => VOCAB_BY_TAG.get(t)!.artists?.slice(0, 2) ?? [])
    .map((a) => ({ id: `pg_${hashString(a)}`, name: a, category: "Musician/Band" }));
  const year = now.getFullYear() - BAND_AGE[input.ageBand];
  return {
    id,
    name: input.name,
    first_name: first,
    last_name: rest.join(" ") || "",
    birthday: `01/01/${year}`,
    gender: input.gender === "woman" ? "female" : input.gender === "man" ? "male" : input.gender === "nonbinary" ? "custom" : null,
    location: { name: "Bay Area, California", latitude: 37.4443, longitude: -122.1611 },
    picture: { data: { color: ["#1877f2", "#e41e3f", "#45bd62", "#7c3aed", "#ff6f00", "#0ea5e9"][hashString(id) % 6] } },
    likes: { data: pages },
    groups: { data: groups },
    music: { data: music },
    events: { data: [] },
    friends: { data: [], summary: { total_count: 0 } },
    x_not_interested: {
      data: input.dislikes.map((t) => {
        const v = VOCAB_BY_TAG.get(t)!;
        return { id: `pg_${hashString(v.pages[0])}`, name: v.pages[0], category: v.category };
      }),
    },
    x_availability: {
      data: AVAIL_SLOTS.filter((s) => input.availability.includes(s.id)).map((s) => ({ day: s.day, start: s.start, end: s.end })),
    },
    x_preferences: { women_only_party: input.womenOnlyParty },
  };
}

/** "Use a sample Facebook profile": borrow interests/availability from a seeded persona template. */
export const SAMPLE_TEMPLATES = ["p05", "p11", "p14", "p03", "p12", "p07", "p13", "p15", "p08", "p06"];
