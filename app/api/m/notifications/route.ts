import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/server/session";
import { listNotifications } from "@/lib/server/notifications";
import { getTabSeen } from "@/lib/server/badges";
import { now as clockNow } from "@/lib/server/clock";
import { eventCoverSrc } from "@/lib/images";

export const dynamic = "force-dynamic";

/** Notifications as JSON, for the Expo app (mirrors app/(app)/notifications/page.tsx). */
export async function GET() {
  const userId = await getCurrentUserId();
  const now = await clockNow();
  const [items, seen] = await Promise.all([listNotifications(userId, now), getTabSeen(userId, "notifications")]);
  return NextResponse.json({ now, items: items.map((n) => ({ ...n, unread: n.at > seen && n.kind !== "reminder", photoUrl: n.kind === "reminder" ? (eventCoverSrc(n.href.split("/")[2] ?? "") ?? null) : null })) });
}
