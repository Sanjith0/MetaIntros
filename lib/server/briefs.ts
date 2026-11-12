import { prisma } from "@/lib/db";
import { toJson } from "@/lib/json";
import { briefFromGenerated, generate, isShare, sourceFacts, templateBrief, type Brief, type Generated, type QueueContext, type Share } from "@/lib/companion/brief";
import { loadPeople, type Person } from "@/lib/profile/load";

type Row = { shares: unknown; generated: unknown } | null | undefined;

const sharesOf = (row: Row) => (row?.shares ?? {}) as Record<string, Share>;

async function briefFor(p: Person, ctx: QueueContext, row: Row, useModel: boolean): Promise<Brief> {
  const shares = sharesOf(row);
  if (row?.generated) return briefFromGenerated(p, ctx, shares, row.generated as Generated, "cache");
  if (!useModel) return templateBrief(p, ctx, shares);
  const { gen, source } = await generate(p);
  // Keep model output so each person is analysed once; a fallback is not stored, so a later run can retry.
  if (source !== "fallback") {
    await prisma.companionBrief.upsert({
      where: { userId: p.id },
      create: { userId: p.id, shares: toJson(shares), generated: toJson(gen) },
      update: { generated: toJson(gen) },
    });
  }
  return briefFromGenerated(p, ctx, shares, gen, source);
}

/** One person's brief (their stored share choices applied). */
export async function getBriefFor(userId: string, ctx: QueueContext, useModel: boolean): Promise<Brief | null> {
  const p = (await loadPeople(prisma, [userId])).get(userId);
  if (!p) return null;
  return briefFor(p, ctx, await prisma.companionBrief.findUnique({ where: { userId } }), useModel);
}

/** Briefs for a whole room. `useModel(p)` says whose brief may spend a model call. */
export async function ensureBriefs(people: Person[], ctx: QueueContext, useModel: (p: Person) => boolean): Promise<Map<string, Brief>> {
  const rows = new Map((await prisma.companionBrief.findMany({ where: { userId: { in: people.map((p) => p.id) } } })).map((r) => [r.userId, r]));
  const briefs = await Promise.all(people.map((p) => briefFor(p, ctx, rows.get(p.id), useModel(p))));
  return new Map(briefs.map((b) => [b.ownerId, b]));
}

/** The person chooses what their Companion may share. */
export async function setShare(userId: string, factId: string, share: unknown): Promise<{ ok: true } | { ok: false; error: "unknown_fact" | "bad_share" }> {
  if (!isShare(share)) return { ok: false, error: "bad_share" };
  const p = (await loadPeople(prisma, [userId])).get(userId);
  if (!p || !sourceFacts(p).some((f) => f.id === factId)) return { ok: false, error: "unknown_fact" };
  const row = await prisma.companionBrief.findUnique({ where: { userId } });
  const shares = { ...sharesOf(row), [factId]: share };
  await prisma.companionBrief.upsert({ where: { userId }, create: { userId, shares: toJson(shares) }, update: { shares: toJson(shares) } });
  return { ok: true };
}
