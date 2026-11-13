import { NextResponse } from "next/server";
import { getPartyForUser, isRevealed } from "@/lib/server/party";
import { getCurrentUserId } from "@/lib/server/session";
import { squadName } from "@/lib/server/squadChat";
import { getShareChoice, shareOpen } from "@/lib/server/posts";
import { now as clockNow } from "@/lib/server/clock";
import { prisma } from "@/lib/db";
import { personaFrom } from "@/lib/profile/persona";

export const dynamic = "force-dynamic";

/** Squad info as JSON, for the Expo app (mirrors app/(app)/squad/[partyId]/page.tsx). */
export async function GET(_req: Request, { params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const me = await getCurrentUserId();
  const p = await getPartyForUser(me, partyId);
  if (!p?.event || !isRevealed(p.status)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ev = p.event;
  const people = p.members.map((m) => ({ ...m.user, checkedIn: Boolean(m.checkedInAt) }));
  const others = people.filter((u) => u.id !== me);
  const ready = p.status === "confirmed" || p.status === "completed";
  const [choice, now] = await Promise.all([getShareChoice(partyId, me), clockNow()]);
  const intros = new Map(
    (await prisma.user.findMany({ where: { id: { in: others.map((u) => u.id) } }, select: { id: true, rawGraph: true } })).map((u) => [u.id, personaFrom(u.rawGraph).about]),
  );
  return NextResponse.json({
    meId: me,
    partyId,
    name: squadName(ev.title),
    status: p.status,
    chat: p.chat ? { id: p.chat.id, archived: p.chat.archived } : null,
    event: { id: ev.id, title: ev.title, startsAt: ev.startsAt, endsAt: ev.endsAt, venueName: ev.venueName, venueAddress: ev.venueAddress, lat: ev.lat, lng: ev.lng },
    sharePrompt: ready && shareOpen(p, now) && !choice,
    canLeave: p.status === "confirmed" && !p.chat?.archived,
    members: people.map((u) => ({
      id: u.id, name: u.name, avatarColor: u.avatarColor, checkedIn: u.checkedIn, about: intros.get(u.id) ?? null,
      sample: u.id !== me && Boolean(u.isSimulated && !u.isLive),
    })),
  });
}
