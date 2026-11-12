import { NextResponse } from "next/server";
import { getFeed, type FeedTab } from "@/lib/server/events";
import { getCurrentUserId } from "@/lib/server/session";
import { now } from "@/lib/server/clock";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tab = (new URL(req.url).searchParams.get("tab") ?? "foryou") as FeedTab;
  const feed = await getFeed(await getCurrentUserId(), tab, await now());
  return NextResponse.json(feed.map((e) => ({ id: e.id, title: e.title, friendsInterested: e.friendsInterested })));
}
