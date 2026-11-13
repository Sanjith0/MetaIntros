import { NextResponse } from "next/server";
import { getChatForUser, markChatRead } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { now } from "@/lib/server/clock";
import { getSquadHeader } from "@/lib/server/squadChat";
import { sweepExpiredChats } from "@/lib/server/expiry";
import { getRatingState } from "@/lib/server/ratings";

export const dynamic = "force-dynamic";

/** One chat as JSON, for the Expo app (mirrors app/(app)/chats/[id]/page.tsx); opening it marks it read. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  await sweepExpiredChats();
  const chat = await getChatForUser(userId, id);
  if (!chat) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markChatRead(userId, id, await now());
  const squad = chat.type === "squad" ? await getSquadHeader(id) : null;
  const rating = chat.type === "squad" && chat.partyId ? await getRatingState(chat.partyId, userId) : null;
  return NextResponse.json({ meId: userId, chat, squad, rating });
}
