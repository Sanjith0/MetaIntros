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
