import { NextResponse } from "next/server";
import { listInbox } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { sweepExpiredChats } from "@/lib/server/expiry";
import { now } from "@/lib/server/clock";

export const dynamic = "force-dynamic";

/** The chats inbox as JSON, for the Expo app. */
export async function GET() {
  const userId = await getCurrentUserId();
  await sweepExpiredChats();
  const [rows, t] = await Promise.all([listInbox(userId), now()]);
  return NextResponse.json({ meId: userId, now: t, rows });
}
