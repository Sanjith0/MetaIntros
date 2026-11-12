import { NextResponse } from "next/server";
import { markChatRead } from "@/lib/server/chats";
import { getCurrentUserId } from "@/lib/server/session";
import { publish } from "@/lib/server/bus";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  await markChatRead(userId, id, new Date());
  publish("badges", {}, [userId]);
  return NextResponse.json({ ok: true });
}
