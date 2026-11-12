import { prisma } from "@/lib/db";

/** Wipe every table (children first). Used by DB tests for isolation. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.postPhoto.deleteMany(),
    prisma.post.deleteMany(),
    prisma.albumPhoto.deleteMany(),
    prisma.shareChoice.deleteMany(),
    prisma.agentTrace.deleteMany(),
    prisma.preChat.deleteMany(),
    prisma.talkCard.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.chatMember.deleteMany(),
    prisma.chat.deleteMany(),
    prisma.friendRequest.deleteMany(),
    prisma.partyMember.deleteMany(),
    prisma.queueEntry.deleteMany(),
    prisma.queueGroupMember.deleteMany(),
    prisma.queueGroup.deleteMany(),
    prisma.party.deleteMany(),
    prisma.eventRsvp.deleteMany(),
    prisma.friendship.deleteMany(),
    prisma.event.deleteMany(),
    prisma.landmark.deleteMany(),
    prisma.block.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.tasteProfile.deleteMany(),
    prisma.deviceSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.appSetting.deleteMany(),
  ]);
}

let n = 0;
export async function makeUser(over: Partial<Parameters<typeof prisma.user.create>[0]["data"]> = {}) {
  n += 1;
  return prisma.user.create({ data: { name: `User ${n}`, ageBand: "18-24", ...over } });
}

export async function makeLandmark(id = "lm-oval") {
  return prisma.landmark.create({
    data: { id, name: "Stanford Oval", city: "Stanford", lat: 37.4294, lng: -122.1697 },
  });
}

export async function makeEvent(landmarkId?: string) {
  const startsAt = new Date("2026-11-14T18:00:00Z");
  return prisma.event.create({
    data: {
      title: "Indie Night",
      description: "Live indie bands",
      tags: ["indie-music"],
      startsAt,
      endsAt: new Date(startsAt.getTime() + 3 * 3600_000),
      venueName: "The Guild",
      venueAddress: "949 El Camino Real, Menlo Park",
      lat: 37.45,
      lng: -122.18,
      capacity: 200,
      hostName: "The Guild",
      landmarkId,
    },
  });
}

export async function makeParty(landmarkId: string, eventId?: string) {
  return prisma.party.create({ data: { landmarkId, eventId, targetSize: 6, ageBand: "18-24" } });
}
