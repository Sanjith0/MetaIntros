import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { getBadges } from "@/lib/server/badges";

export const dynamic = "force-dynamic";

/** Who is signed in on this phone, and the tab badges, for the Expo app. */
export async function GET() {
  const me = await getCurrentUser();
  const badges = await getBadges(me.id);
  return NextResponse.json({ me: { id: me.id, name: me.name, avatarColor: me.avatarColor, photoUrl: (me as { photoUrl?: string | null }).photoUrl ?? null }, badges });
}
