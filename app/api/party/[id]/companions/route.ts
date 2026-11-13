import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";
import type { Recap } from "@/lib/companion/recap";

export const dynamic = "force-dynamic";

/**
 * How this member's squad was decided, as this member may see it. Members only, and only once the
 * squad is confirmed (after the ready check). People who aren't in the squad stay anonymous:
 * "Someone nearby", and their names are removed from the explanations.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUserId();
  const party = await prisma.party.findUnique({ where: { id }, include: { members: { include: { user: { select: { id: true, name: true, avatarColor: true } } } } } });
  if (!party?.members.some((m) => m.userId === me)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (party.status !== "confirmed" && party.status !== "completed") return NextResponse.json({ pending: true });
  const row = await prisma.companionRecap.findUnique({ where: { partyId_userId: { partyId: id, userId: me } } });
  if (!row) return NextResponse.json({ pending: true }); // not written yet, or a squad formed without the Companion engine
  const recap = row.data as unknown as Recap;
  const squad = new Set(party.members.map((m) => m.userId));
  const outsiders = [...new Set([...recap.numbers.similarityPick.map((x) => x.id), ...recap.numbers.passedOver.map((x) => x.id)])].filter((u) => !squad.has(u));
  const outsiderUsers = await prisma.user.findMany({ where: { id: { in: outsiders } }, select: { id: true, name: true, avatarColor: true } });
  const scrub = (t: string) =>
    outsiderUsers.reduce((acc, u) => acc.replace(new RegExp(`\\b${u.name.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "them"), t);
  const people = Object.fromEntries([
    ...party.members.map((m) => [m.user.id, { name: m.user.name, avatarColor: m.user.avatarColor }] as const),
    ...outsiderUsers.map((u) => [u.id, { name: "Someone nearby", avatarColor: u.avatarColor, anonymous: true }] as const),
  ]);
  const safe: Recap = { ...recap, numbers: { ...recap.numbers, passedOver: recap.numbers.passedOver.map((x) => ({ ...x, reason: scrub(x.reason) })) } };
  return NextResponse.json({ me, people, recap: safe });
}
