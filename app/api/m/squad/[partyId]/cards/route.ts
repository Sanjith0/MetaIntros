import { NextResponse } from "next/server";
import { isRevealed } from "@/lib/server/party";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";
import { getTalkCards } from "@/lib/server/talkCards";
import { validateCard, type CardSubject } from "@/lib/cards/claims";
import { loadPeople } from "@/lib/profile/load";
import { getPreChatsFor } from "@/lib/server/preChats";

export const dynamic = "force-dynamic";

/** Talk cards as JSON, for the Expo app (mirrors app/(app)/squad/[partyId]/cards/page.tsx). */
export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const me = await getCurrentUserId();
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { members: true, event: { select: { title: true } } } });
  if (!party || !party.members.some((m) => m.userId === me) || !isRevealed(party.status)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const people = await loadPeople(prisma, party.members.map((m) => m.userId));
  const subjects = new Map<string, CardSubject>([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));
  const cards = (await getTalkCards(partyId, me)).map((c) => ({ ...c, content: validateCard(c.content, subjects) }));
  const order = party.members.map((m) => m.userId);
  cards.sort((a, b) => order.indexOf(a.subject.id) - order.indexOf(b.subject.id));
  const pre = await getPreChatsFor(partyId, me);
  const flags = new Map((await prisma.user.findMany({ where: { id: { in: order } }, select: { id: true, isSimulated: true, isLive: true } })).map((u) => [u.id, u]));
  return NextResponse.json({
    meId: me,
    eventTitle: party.event?.title ?? "",
    cards: cards.map((c) => ({
      ...c,
      subject: { ...c.subject, isSimulated: flags.get(c.subject.id)?.isSimulated, isLive: flags.get(c.subject.id)?.isLive },
      preChat: pre.find((p) => p.otherId === c.subject.id) ?? null,
    })),
  });
}
