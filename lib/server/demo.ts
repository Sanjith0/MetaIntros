import { prisma } from "@/lib/db";
import { aiLog, getAiMode } from "@/lib/ai";
import { getClockOffsetMs } from "./clock";
import { getSetting } from "./settings";
import { publish } from "./bus";
import { cancelAllSims } from "./queue";

export async function demoStatus() {
  const [waiting, parties, liveUsers] = await Promise.all([
    prisma.queueEntry.findMany({
      where: { status: "waiting" },
      include: { user: { select: { id: true, name: true, avatarColor: true, isSimulated: true, isLive: true, ageBand: true } }, bucketLandmark: { select: { name: true } }, event: { select: { title: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.party.findMany({
      where: { status: { in: ["confirmed", "completed"] } },
      include: { members: { include: { user: { select: { name: true, isSimulated: true } } } }, event: { select: { title: true } }, landmark: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.user.count({ where: { isLive: true } }),
  ]);
  const buckets: Record<string, { size: number; users: { id: string; name: string; avatarColor: string; real: boolean; waitedMs: number; event: string | null }[] }[]> = {};
  for (const w of waiting) {
    const b = (buckets[w.bucketLandmark.name] ??= []);
    let g = b.find((x) => x.size === w.targetPartySize);
    if (!g) b.push((g = { size: w.targetPartySize, users: [] }));
    g.users.push({ id: w.user.id, name: w.user.name, avatarColor: w.user.avatarColor, real: !w.user.isSimulated, waitedMs: Date.now() - w.joinedAt.getTime(), event: w.event?.title ?? null });
  }
  return {
    fillMode: await getSetting("fillMode", "simulated"),
    simFillMs: Number(await getSetting("simFillMs", "18000")),
    aiMode: getAiMode(),
    hasModelKey: Boolean(process.env.MODEL_API_KEY),
    model: process.env.MUSE_MODEL ?? "muse-spark-1.1",
    clockOffsetMs: await getClockOffsetMs(),
    liveUsers,
    buckets,
    parties: parties.map((p) => ({ id: p.id, status: p.status, event: p.event?.title ?? null, area: p.landmark.name, size: p.members.length, real: p.members.filter((m) => !m.user.isSimulated).length, cohesion: p.cohesion })),
    aiLog: aiLog().slice(-12),
  };
}

/** Remove everyone who signed up live (judges' phones) without touching the personas. */
export async function kickLiveUsers() {
  cancelAllSims();
  const live = await prisma.user.findMany({ where: { isLive: true }, select: { id: true } });
  const ids = live.map((u) => u.id);
  const parties = await prisma.partyMember.findMany({ where: { userId: { in: ids } }, select: { partyId: true } });
  await prisma.party.deleteMany({ where: { id: { in: parties.map((p) => p.partyId) } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  publish("demo", { type: "kick" });
  return ids.length;
}
