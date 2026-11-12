import type { PrismaClient } from "@prisma/client";
import { buildTasteProfile } from "@/lib/profile/builder";
import { graphFromSignup, SAMPLE_TEMPLATES, type SignupInput } from "@/lib/signup";
import { MockGraphSource } from "@/lib/graph/source";
import type { GraphUser } from "@/lib/graph/schema";
import { toJson } from "@/lib/json";
import { randomUUID } from "node:crypto";

async function persist(prisma: PrismaClient, g: GraphUser, extra: { ageBand: string; gender: string | null; womenOnlyParty: boolean }) {
  const p = buildTasteProfile(g);
  await prisma.user.create({
    data: {
      id: g.id,
      name: g.name,
      avatarColor: g.picture.data.color,
      ageBand: extra.ageBand,
      gender: extra.gender,
      womenOnlyParty: extra.womenOnlyParty,
      isLive: true,
      isSimulated: false,
      locationSource: "manual",
      rawGraph: toJson(g),
      tasteProfile: {
        create: {
          likes: toJson(p.likes), dislikes: toJson(p.dislikes), groups: toJson(p.groups), music: toJson(p.music),
          eventHistory: toJson(p.eventHistory), interestTags: toJson(p.interestTags), embedding: p.embedding, socialStyle: p.socialStyle,
        },
      },
      availability: { create: p.availability },
    },
  });
  const session = await prisma.deviceSession.create({ data: { userId: g.id } });
  return { userId: g.id, sessionId: session.id };
}

export async function createLiveUser(prisma: PrismaClient, input: SignupInput) {
  const id = `live-${randomUUID().slice(0, 8)}`;
  return persist(prisma, graphFromSignup(id, input), input);
}

/** Sample profile: a template persona's interests + availability under the live user's own name. */
export async function createSampleLiveUser(
  prisma: PrismaClient,
  input: Pick<SignupInput, "name" | "ageBand" | "gender" | "womenOnlyParty">,
) {
  const n = await prisma.user.count({ where: { isLive: true } });
  const tpl = new MockGraphSource().getUser(SAMPLE_TEMPLATES[n % SAMPLE_TEMPLATES.length]);
  const id = `live-${randomUUID().slice(0, 8)}`;
  const [first, ...rest] = input.name.trim().split(/\s+/);
  const g: GraphUser = {
    ...tpl,
    id,
    name: input.name.trim(),
    first_name: first,
    last_name: rest.join(" "),
    friends: { data: [], summary: { total_count: 0 } },
    x_preferences: { women_only_party: input.womenOnlyParty },
    x_cluster: undefined,
  };
  return persist(prisma, g, input);
}

/** What /join promises: live sign-ups are deleted 24 hours after they're created (or sooner, on request). */
export const SIGNUP_TTL_MS = 24 * 3600_000;

/** Queue Up is 18+. Age is self-declared in this demo; this is the gate at sign-up and at the queue. */
export const isAdultBand = (band: string) => band === "18-24" || band === "25+";

/**
 * Delete one live sign-up and everything keyed to them (profile, availability, sessions, RSVPs, queue
 * entries, squad memberships, chat memberships, requests, talk cards via cascades). Their chat messages stay
 * in the thread with no sender, so other people's conversations don't break. Seeded personas can't be deleted.
 */
export async function deleteLiveUser(prisma: PrismaClient, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isLive: true } });
  if (!u?.isLive) return false;
  await prisma.user.delete({ where: { id: userId } });
  return true;
}

/**
 * Remove every live sign-up older than the TTL. Cheap; called from sign-up and the demo panel's poll.
 * Deliberately real time, not the global demo clock: a Fast-forward must never delete judges mid-demo.
 */
export async function sweepExpiredSignups(prisma: PrismaClient, now = new Date()) {
  const r = await prisma.user.deleteMany({ where: { isLive: true, createdAt: { lt: new Date(now.getTime() - SIGNUP_TTL_MS) } } });
  return r.count;
}
