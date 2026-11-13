import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { friendIdsOf } from "@/lib/server/events";
import { getOrCreateGroup, inviteFriend, joinByCode, leaveGroup, myGroupState, respondToInvite, safeWithGroup } from "@/lib/server/groups";
import { getCurrentUserId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Your queue-together group, invites for you, and which friends you could invite (safety-checked in code). */
export async function GET() {
  const userId = await getCurrentUserId();
  const state = await myGroupState(userId);
  const memberIds = state.group ? state.group.members.filter((m) => m.status === "joined").map((m) => m.id) : [userId];
  const inGroup = new Map((state.group?.members ?? []).map((m) => [m.id, m.status]));
  const friendIds = [...(await friendIdsOf(userId))];
  const users = await prisma.user.findMany({ where: { id: { in: friendIds } }, select: { id: true, name: true, avatarColor: true }, orderBy: { name: "asc" } });
  const friends = [];
  for (const u of users) friends.push({ ...u, status: inGroup.get(u.id) ?? null, eligible: inGroup.has(u.id) || (await safeWithGroup(u.id, memberIds)) });
  return NextResponse.json({ ...state, friends });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("invite"), userId: z.string() }),
  z.object({ action: z.literal("respond"), groupId: z.string(), accept: z.boolean() }),
  z.object({ action: z.literal("join"), code: z.string().min(4).max(8) }),
  z.object({ action: z.literal("leave") }),
]);

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ ok: false, error: "bad_body" }, { status: 400 });
  const userId = await getCurrentUserId();
  const b = p.data;
  const r =
    b.action === "create" ? await getOrCreateGroup(userId)
    : b.action === "invite" ? await inviteFriend(userId, b.userId)
    : b.action === "respond" ? await respondToInvite(userId, b.groupId, b.accept)
    : b.action === "join" ? await joinByCode(userId, b.code)
    : (await leaveGroup(userId), { ok: true as const });
  return NextResponse.json(r, { status: r.ok ? 200 : r.error === "not_found" ? 404 : 400 });
}
