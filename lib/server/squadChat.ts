import { prisma } from "@/lib/db";
import { postMessage } from "./messages";

export const CHAT_TTL_AFTER_EVENT_MS = 24 * 3600_000;

export function squadName(eventTitle: string) {
  return `${eventTitle.split(/[:—–-]/)[0].trim()} Squad`;
}

/** Temporary squad group chat: expires 24h after the event ends. */
export async function createSquadChat(partyId: string) {
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId }, include: { event: true, members: true, chat: true } });
  if (party.chat) return party.chat;
  if (!party.event) throw new Error("party has no event");
  const chat = await prisma.chat.create({
    data: {
      type: "squad",
      title: squadName(party.event.title),
      partyId,
      eventId: party.event.id,
      expiresAt: new Date(party.event.endsAt.getTime() + CHAT_TTL_AFTER_EVENT_MS),
      members: { create: party.members.map((m) => ({ userId: m.userId, lastReadAt: new Date(0) })) },
    },
  });
  await postMessage(chat.id, null, `Link formed your squad of ${party.members.length} for ${party.event.title}. This chat disappears 24h after the event.`, "system");
  return chat;
}

export async function getSquadHeader(chatId: string) {
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      party: {
        include: {
          landmark: true,
          event: true,
          members: { include: { user: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { joinedAt: "asc" } },
        },
      },
    },
  });
  if (!chat?.party?.event) return null;
  const p = chat.party;
  const ev = p.event!;
  return {
    partyId: p.id,
    chatId: chat.id,
    expiresAt: chat.expiresAt?.toISOString() ?? null,
    archived: chat.archived,
    event: { id: ev.id, title: ev.title, startsAt: ev.startsAt.toISOString(), endsAt: ev.endsAt.toISOString(), venueName: ev.venueName, venueAddress: ev.venueAddress, lat: ev.lat, lng: ev.lng },
    meetingSpot: `Front entrance, ${ev.venueName}`,
    area: p.landmark.name,
    members: p.members.map((m) => ({ ...m.user, checkedInAt: m.checkedInAt?.toISOString() ?? null, photoUrl: m.photoOptIn ? m.photoUrl : null })),
  };
}
export type SquadHeaderInfo = NonNullable<Awaited<ReturnType<typeof getSquadHeader>>>;
