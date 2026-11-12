import type { PrismaClient } from "@prisma/client";
import LANDMARKS from "@/data/seed/landmarks.json";
import EVENTS from "@/data/seed/events.json";
import CHATS from "@/data/seed/chats.json";
import RSVPS from "@/data/seed/rsvps.json";
import BLOCKS from "@/data/seed/blocks.json";
import { MockGraphSource, type GraphSource } from "@/lib/graph/source";
import { ageFromBirthday, DAY_INDEX, genderFromGraph, hhmmToMin } from "@/lib/graph/schema";
import { ageBandFor, normalizePair } from "@/lib/domain/enums";
import { nearestLandmark } from "@/lib/geo";
import { ME_ID } from "./generate";
import { buildTasteProfile } from "@/lib/profile/builder";
import { toJson } from "@/lib/json";
import { setWorldWeekendInMemory } from "@/lib/clock";

export { ME_ID };

/** Seeded friends of Jordan (ME_ID) already in a queue. Reza's is the demo path: Indie Night. */
export const FRIEND_QUEUES: { userId: string; mode: "events" | "hangout"; eventId: string | null; landmarkId: string; minutesAgo: number; visible: boolean }[] = [
  { userId: "p04", mode: "events", eventId: "ev-indie-guild", landmarkId: "lm-menlo-caltrain", minutesAgo: 4, visible: true },
  { userId: "p02", mode: "events", eventId: "ev-photo-walk", landmarkId: "lm-shoreline", minutesAgo: 11, visible: true },
  { userId: "p45", mode: "hangout", eventId: null, landmarkId: "lm-downtown-pa", minutesAgo: 23, visible: true },
  { userId: "p50", mode: "events", eventId: "ev-baylands-birding", landmarkId: "lm-shoreline", minutesAgo: 7, visible: false },
];

/** Friday 00:00 local of "this weekend" (today if Fri/Sat/Sun, else the coming Friday). */
export function weekendFriday(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = d.getDay();
  const delta = day === 5 ? 0 : day === 6 ? -1 : day === 0 ? -2 : 5 - day;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Friday evening events start at 18:00; seeding after 17:00 Friday uses the next weekend. */
const SEED_CUTOFF_MIN = 17 * 60;

/**
 * The weekend the demo world is seeded into: this weekend if its Friday-evening events are still
 * ahead of `now`, otherwise the next one (e.g. reseeding after Fast-forward past Friday night).
 */
export function seedWeekendFriday(now: Date): Date {
  const fri = weekendFriday(now);
  const cutoff = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate(), 0, SEED_CUTOFF_MIN);
  return now >= cutoff ? new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + 7) : fri;
}

export function eventTimes(now: Date, dayOffset: number, start: string, durationMin: number) {
  const fri = seedWeekendFriday(now);
  const startsAt = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + dayOffset, 0, hhmmToMin(start));
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMin * 60_000) };
}

export interface SeedOptions {
  now?: Date;
  source?: GraphSource;
}

/**
 * Wipe-and-reseed in one transaction with stable IDs → idempotent.
 * Live users and all Queue Up activity (parties, squad chats …) are cleared too.
 */
export async function seedDatabase(prisma: PrismaClient, opts: SeedOptions = {}) {
  // The global clock (lib/clock.ts) survives a reseed; the world is rebuilt around *its* now.
  const clockRow = await prisma.appSetting.findUnique({ where: { key: "clockOffsetMs" } });
  const now = opts.now ?? new Date(Date.now() + (Number(clockRow?.value) || 0));
  const source = opts.source ?? new MockGraphSource();
  const graphUsers = source.listUserIds().map((id) => source.getUser(id));

  await prisma.$transaction(
    async (tx) => {
      // children first
      for (const m of [
        "postPhoto", "post", "albumPhoto", "shareChoice",
        "agentTrace", "preChat", "talkCard", "chatMessage", "chatMember", "chat", "friendRequest",
        "partyMember", "queueEntry", "queueGroupMember", "queueGroup", "party", "eventRsvp", "friendship", "event", "landmark", "block",
        "availability", "tasteProfile", "deviceSession", "user", "appSetting",
      ] as const) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any)[m].deleteMany(m === "appSetting" ? { where: { key: { not: "clockOffsetMs" } } } : undefined);
      }

      await tx.landmark.createMany({ data: LANDMARKS });

      await tx.user.createMany({
        data: graphUsers.map((g) => {
          const age = ageFromBirthday(g.birthday, now);
          return {
            id: g.id,
            createdAt: new Date(now.getTime() - 400 * 86400_000),
            name: g.name,
            avatarColor: g.picture.data.color,
            age,
            ageBand: ageBandFor(age),
            gender: genderFromGraph(g.gender),
            womenOnlyParty: g.x_preferences.women_only_party,
            isMe: g.id === ME_ID,
            isSimulated: g.id !== ME_ID,
            isLive: false,
            homeLat: g.location.latitude,
            homeLng: g.location.longitude,
            neighborhood: g.location.name.split(",")[0],
            locationSource: "seed",
            cluster: g.x_cluster ?? null,
            rawGraph: g,
          };
        }),
      });

      await tx.tasteProfile.createMany({
        data: graphUsers.map((g) => {
          const p = buildTasteProfile(g);
          return {
            id: `tp-${g.id}`,
            userId: g.id,
            likes: toJson(p.likes),
            dislikes: toJson(p.dislikes),
            groups: toJson(p.groups),
            music: toJson(p.music),
            eventHistory: toJson(p.eventHistory),
            interestTags: toJson(p.interestTags),
            embedding: p.embedding,
            socialStyle: p.socialStyle,
          };
        }),
      });

      await tx.availability.createMany({
        data: graphUsers.flatMap((g) =>
          g.x_availability.data.map((b, i) => ({
            id: `av-${g.id}-${i}`,
            userId: g.id,
            dayOfWeek: DAY_INDEX[b.day],
            startMin: hhmmToMin(b.start),
            endMin: hhmmToMin(b.end),
          })),
        ),
      });

      const pairs = new Set<string>();
      for (const g of graphUsers) for (const f of g.friends.data) pairs.add(normalizePair(g.id, f.id).join("|"));
      await tx.friendship.createMany({
        data: [...pairs].sort().map((p) => {
          const [a, b] = p.split("|");
          return { id: `fr-${a}-${b}`, userAId: a, userBId: b, source: "existing" };
        }),
      });

      await tx.block.createMany({ data: BLOCKS.map((b) => ({ id: `blk-${b.blockerId}-${b.blockedId}`, ...b })) });

      // One pending incoming request so the Requests tab isn't empty.
      await tx.friendRequest.create({
        data: { id: "freq-p78-p01", fromId: "p78", toId: ME_ID, status: "pending", createdAt: new Date(now.getTime() - 3 * 3600_000) },
      });

      await tx.event.createMany({
        data: EVENTS.map((e) => {
          const { startsAt, endsAt } = eventTimes(now, e.dayOffset, e.start, e.durationMin);
          return {
            id: e.id,
            title: e.title,
            description: e.description,
            tags: e.tags,
            startsAt,
            endsAt,
            venueName: e.venueName,
            venueAddress: e.venueAddress,
            lat: e.lat,
            lng: e.lng,
            isPublicVenue: (e as { isPublicVenue?: boolean }).isPublicVenue ?? true,
            capacity: e.capacity,
            coverColor: e.coverColor,
            coverPattern: e.coverPattern,
            hostName: e.hostName,
            landmarkId: nearestLandmark(e, LANDMARKS).landmark.id,
            createdAt: new Date(now.getTime() - 14 * 86400_000),
          };
        }),
      });

      // Friends' queues (demo): three of Jordan's friends are queuing and share it; one queues privately.
      // Parked, so the matcher leaves them alone until a real person joins the same queue.
      for (const f of FRIEND_QUEUES) {
        const lm = LANDMARKS.find((l) => l.id === f.landmarkId)!;
        if (f.visible) await tx.user.update({ where: { id: f.userId }, data: { queueVisibility: "friends", queueVisibilityAskedAt: now } });
        await tx.queueEntry.create({
          data: {
            id: `fq-${f.userId}`,
            userId: f.userId,
            mode: f.mode,
            eventId: f.eventId,
            targetPartySize: 5,
            lat: lm.lat,
            lng: lm.lng,
            bucketLandmarkId: lm.id,
            joinedAt: new Date(now.getTime() - f.minutesAgo * 60_000),
            visibleToFriends: f.visible,
            parked: true,
          },
        });
      }

      await tx.eventRsvp.createMany({
        data: RSVPS.map((r) => ({ id: `rsvp-${r.eventId}-${r.userId}`, ...r })),
      });

      const ago = (min: number) => new Date(now.getTime() - min * 60_000);
      for (const c of CHATS) {
        const last = Math.min(...c.messages.map((m) => m.minutesAgo));
        await tx.chat.create({
          data: {
            id: c.id,
            type: c.type,
            title: c.title,
            createdAt: ago(Math.max(...c.messages.map((m) => m.minutesAgo)) + 60),
            lastMessageAt: ago(last),
            members: {
              create: c.memberIds.map((uid) => ({
                id: `cm-${c.id}-${uid}`,
                userId: uid,
                lastReadAt: uid === ME_ID ? ago(c.meReadMinutesAgo) : ago(last),
              })),
            },
            messages: {
              create: c.messages.map((m, i) => ({
                id: `msg-${c.id}-${i}`,
                senderId: m.senderId,
                kind: "user",
                body: m.body,
                createdAt: ago(m.minutesAgo),
              })),
            },
          },
        });
      }

      await tx.appSetting.createMany({
        data: [
          { key: "seededAt", value: now.toISOString() },
          { key: "weekendStart", value: seedWeekendFriday(now).toISOString() },
          { key: "fillMode", value: "simulated" },
          // clockOffsetMs is deliberately absent: the global clock is never reset by a reseed
        ],
      });
    },
    { timeout: 60_000 },
  );
  setWorldWeekendInMemory(seedWeekendFriday(now).getTime());

  return { users: graphUsers.length };
}
