import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/server/session";
import { getTalkCards } from "@/lib/server/talkCards";
import { validateCard, type CardSubject } from "@/lib/cards/claims";
import { loadPeople } from "@/lib/profile/load";
import { TalkCardDeck } from "@/components/cards/TalkCardDeck";
import { getPreChatsFor } from "@/lib/server/preChats";

export default async function CardsPage({ params, searchParams }: { params: Promise<{ partyId: string }>; searchParams: Promise<{ member?: string }> }) {
  const { partyId } = await params;
  const { member } = await searchParams;
  const me = await getCurrentUserId();
  const party = await prisma.party.findUnique({ where: { id: partyId }, include: { members: true, chat: { select: { id: true } }, event: { select: { title: true } } } });
  if (!party || !party.members.some((m) => m.userId === me)) notFound();
  const people = await loadPeople(prisma, party.members.map((m) => m.userId));
  const subjects = new Map<string, CardSubject>([...people.values()].map((p) => [p.id, { id: p.id, name: p.name, profile: p.profile, friends: p.friends }]));
  // defense in depth: re-validate on read
  const cards = (await getTalkCards(partyId, me)).map((c) => ({ ...c, content: validateCard(c.content, subjects) }));
  const order = party.members.map((m) => m.userId);
  cards.sort((a, b) => order.indexOf(a.subject.id) - order.indexOf(b.subject.id));
  const pre = await getPreChatsFor(partyId, me);
  const flags = new Map((await prisma.user.findMany({ where: { id: { in: order } }, select: { id: true, isSimulated: true, isLive: true } })).map((u) => [u.id, u]));
  const withPre = cards.map((c) => ({
    ...c,
    subject: { ...c.subject, isSimulated: flags.get(c.subject.id)?.isSimulated, isLive: flags.get(c.subject.id)?.isLive },
    preChat: pre.find((p) => p.otherId === c.subject.id) ?? null,
  }));
  return <TalkCardDeck cards={withPre} meId={me} initialMember={member ?? null} partyId={partyId} eventTitle={party.event?.title ?? ""} />;
}
