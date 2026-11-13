import { notFound } from "next/navigation";
import { ShareOuting } from "@/components/posts/ShareOuting";
import { shareState } from "@/lib/server/posts";
import { now } from "@/lib/server/clock";
import { getCurrentUserId } from "@/lib/server/session";

/** "Share the outing": after the event, each member chooses their own post, an AI-suggested one, or none. */
export default async function SharePage({ params }: { params: Promise<{ partyId: string }> }) {
  const { partyId } = await params;
  const s = await shareState(partyId, await getCurrentUserId(), await now());
  if (!s) notFound();
  return <ShareOuting initial={s} />;
}
