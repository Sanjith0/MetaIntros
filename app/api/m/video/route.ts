import { NextResponse } from "next/server";
import { VIDEOS } from "@/lib/mock/feed";

/** The seeded Video tab, for the Expo app (mirrors app/(app)/video/page.tsx). */
export function GET() {
  return NextResponse.json({ videos: VIDEOS });
}
